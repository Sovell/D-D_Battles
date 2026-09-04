import type { AbilityDefinition, ActionTarget, BattleState, Combatant, DamageType, GridPosition, StatusId } from "../domain/types";
import { createRandom, rollDice } from "../random/random";
import { resolveScenarioEvents, resolveStateChangeEvents } from "../scenario/scenario-events";
import { isScenarioConditionMet } from "../scenario/scenario-conditions";
import { hasLineOfSight, terrainAt } from "./line-of-sight";
import { distance, getReachableCells, positionKey } from "./pathfinding";
import { itemAbilityAvailable, recordItemAbilityUse } from "../equipment/battle-equipment";
import { monsterById } from "../data/monsters";
import { basicAttackForLoadout, weaponSwitchAbility } from "../equipment/weapon-attacks";
import { equipmentBonuses } from "../equipment/campaign";
import { heroBattleStats } from "../progression/hero-progression";

export function moveCombatant(state: BattleState, combatantId: string, position: GridPosition): BattleState {
  const legal = getReachableCells(state, combatantId).some((cell) => positionKey(cell) === positionKey(position));
  if (!legal) return appendLog(state, "Nielegalny ruch.", "system");
  let moved = { ...state, combatants: state.combatants.map((unit) => unit.id === combatantId ? { ...unit, position, moved: true } : unit) };
  moved = triggerTrap(moved, combatantId);
  const unit = moved.combatants.find((candidate) => candidate.id === combatantId)!;
  return resolveScenarioEvents(moved, [{ type: "unit-entered-cell", unitId: unit.id, side: unit.side, definitionId: unit.definitionId, position }]);
}

export function getLegalTargets(state: BattleState, actorId: string, abilityId: string): ActionTarget[] {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const ability = actor && findAbility(actor, abilityId);
  if (!actor || !ability || state.outcome !== "active" || activeCombatant(state)?.id !== actor.id || actor.hp <= 0 || actor.acted || actor.charges < ability.resourceCost || abilityCooldownRemaining(state, actor.id, ability.id) > 0 || !itemAbilityAvailable(state, actor, ability.id)) return [];
  if (hasStatus(actor, "wild-shaped") && (ability.tags?.includes("spell") || ability.id.startsWith("item:"))) return [];
  if (ability.special === "aimed-shot" && actor.moved) return [];

  if (ability.target === "self") return [{ kind: "self" }];
  if (ability.target === "cell") {
    if (ability.kind === "move") {
      return getReachableCells(state, actor.id).filter((position) => distance(actor.position, position) <= ability.range).map((position) => ({ kind: "cell", position }));
    }
    return state.map.cells
      .filter((cell) => cell.terrain !== "wall" && distance(actor.position, cell.position) <= ability.range && hasLineOfSight(state.map, actor.position, cell.position))
      .map((cell) => ({ kind: "cell", position: cell.position }));
  }

  const targets: ActionTarget[] = state.combatants
    .filter((target) => isLegalUnitTarget(state, actor, ability, target))
    .map((target) => ({ kind: "unit", unitId: target.id }));
  if (actor.side === "heroes" && ability.kind === "attack" && ability.target === "enemy") {
    targets.push(...state.objectives
      .filter((objective) => objective.hp > 0 && distance(actor.position, objective.position) <= ability.range && (!requiresLineOfSight(ability) || hasLineOfSight(state.map, actor.position, objective.position)))
      .map((objective) => ({ kind: "objective" as const, objectiveId: objective.id })));
  }
  return targets;
}

export function resolveAbility(state: BattleState, actorId: string, abilityId: string, target: ActionTarget): BattleState {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const ability = actor && findAbility(actor, abilityId);
  const legal = getLegalTargets(state, actorId, abilityId).some((candidate) => sameTarget(candidate, target));
  if (!actor || !ability || !legal) return appendLog(state, "Nielegalny cel lub brak zasobów.", "system");
  if (target.kind === "cell" && ability.kind === "move") return resolveMovementAbility(state, actor, ability, target.position);

  const random = createRandom(state.randomState);
  let next = state;
  if (target.kind === "objective") next = resolveObjectiveAttack(next, random, actor, ability, target.objectiveId);
  else if (target.kind === "cell") next = resolveCellAbility(next, random, actor, ability, target.position);
  else {
    const recipient = target.kind === "self" ? actor : state.combatants.find((unit) => unit.id === target.unitId)!;
    next = resolveUnitAbility(next, random, actor, ability, recipient);
  }
  next = recordItemAbilityUse(consumeAbility(next, actor.id, ability, state.round), actor, ability.id);
  const resolved = { ...evaluateOutcome(next), randomState: random.state };
  return resolveStateChangeEvents(state, resolved);
}

export function abilityCooldownRemaining(state: BattleState, actorId: string, abilityId: string): number {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  return Math.max(0, (actor?.cooldowns?.[abilityId] ?? 0) - state.round);
}

export function endActivation(state: BattleState): BattleState {
  if (state.outcome !== "active") return state;
  let nextIndex = state.activeIndex;
  for (let step = 1; step <= state.initiativeOrder.length; step += 1) {
    const candidateIndex = (state.activeIndex + step) % state.initiativeOrder.length;
    const candidate = state.combatants.find((unit) => unit.id === state.initiativeOrder[candidateIndex]);
    if (candidate && candidate.hp > 0) { nextIndex = candidateIndex; break; }
  }
  const wrappedRound = nextIndex <= state.activeIndex;
  const round = state.round + (wrappedRound ? 1 : 0);
  const finishedId = state.initiativeOrder[state.activeIndex];
  const activated = state.combatants.map((unit) => unit.id === finishedId ? { ...unit, activatedRound: state.round } : unit);
  const combatants = wrappedRound
    ? activated.filter((unit) => !unit.tags.includes("summoned") || !unit.statuses.some((status) => status.id === "summoned" && status.remainingRounds <= 1)).map((unit) => { const rageEnds = unit.statuses.some((status) => status.id === "raging" && status.remainingRounds <= 1); const statuses = unit.statuses.map((status) => ({ ...status, remainingRounds: status.remainingRounds - 1 })).filter((status) => status.remainingRounds > 0); return { ...unit, moved: false, acted: false, statuses: rageEnds ? [...statuses, { id: "fatigued" as const, remainingRounds: 1 }] : statuses }; })
    : activated;
  const initiativeOrder = state.initiativeOrder.filter((id) => combatants.some((unit) => unit.id === id));
  const traps = wrappedRound ? (state.traps ?? []).map((trap) => ({ ...trap, remainingRounds: trap.remainingRounds - 1 })).filter((trap) => trap.remainingRounds > 0) : state.traps;
  const advanced = applyTurnStart({ ...state, activeIndex: Math.min(nextIndex, Math.max(0, initiativeOrder.length - 1)), round, combatants, initiativeOrder, traps });
  return resolveStateChangeEvents(state, advanced, wrappedRound ? [{ type: "round-start", round }] : []);
}

export function activeCombatant(state: BattleState): Combatant | undefined {
  return state.combatants.find((unit) => unit.id === state.initiativeOrder[state.activeIndex]);
}

export function isFlanking(state: BattleState, actorId: string, targetId: string): boolean {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const target = state.combatants.find((unit) => unit.id === targetId);
  if (!actor || !target || distance(actor.position, target.position) !== 1) return false;
  const opposite = { x: target.position.x + (target.position.x - actor.position.x), y: target.position.y + (target.position.y - actor.position.y) };
  return state.combatants.some((unit) => unit.id !== actor.id && unit.side === actor.side && unit.hp > 0 && positionKey(unit.position) === positionKey(opposite));
}

function resolveUnitAbility(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, ability: AbilityDefinition, target: Combatant): BattleState {
  if (ability.kind === "heal") {
    if (ability.special === "song-restoration") {
      let next = state;
      for (const ally of state.combatants.filter((unit) => unit.side === actor.side && unit.hp > 0 && distance(actor.position, unit.position) <= (ability.area ?? 0))) {
        const healing = rollDamage(random, ability, false);
        next = updateUnit(next, ally.id, (unit) => ({ ...unit, hp: Math.min(unit.maxHp, unit.hp + healing), statuses: removeOneNegativeStatus(unit.statuses) }));
      }
      return appendLog(next, `${actor.name} przywraca siły pobliskim sojusznikom.`, "damage");
    }
    const beaconBonus = actor.definitionId === "cleric" && target.hp < target.maxHp / 2 ? 2 : 0;
    const healing = rollDamage(random, ability, false) + beaconBonus;
    return appendLog(updateUnit(state, target.id, (unit) => ({ ...unit, hp: Math.min(unit.maxHp, unit.hp + healing) })), `${actor.name} używa ${ability.name}: ${target.name} odzyskuje ${healing} HP${beaconBonus ? " (Beacon of Faith +2)" : ""}.`, "damage");
  }
  if (ability.kind === "status") {
    if (ability.special === "switch-weapon") return switchHeroWeapon(state, actor);
    if (ability.id === "turn-undead") {
      let next = state;
      for (const recipient of state.combatants.filter((unit) => unit.hp > 0 && unit.side !== actor.side && unit.tags.includes("undead") && distance(actor.position, unit.position) <= (ability.area ?? ability.range) && hasLineOfSight(state.map, actor.position, unit.position))) next = resolveStatus(next, random, actor, recipient, ability);
      return next;
    }
    if (ability.special === "call-wild") return summonWolf(state, actor);
    if (ability.special === "intimidating-roar") return applyAreaStatus(state, actor, ability, "enemies", ["weakened"]);
    if (ability.special === "inspire-courage") return applyAreaStatus(state, actor, ability, "allies", ["inspired"]);
    if (ability.special === "crescendo") return applyAreaStatus(state, actor, ability, "allies", ["inspired", "swift"]);
    if (ability.special === "aura-protection") return applyAreaStatus(state, actor, ability, "allies", ["protected"]);
    if (ability.special === "paladin-turn-undead") {
      let next = state;
      for (const enemy of state.combatants.filter((unit) => unit.hp > 0 && unit.side !== actor.side && distance(actor.position, unit.position) <= (ability.area ?? 0))) {
        if (enemy.tags.includes("undead")) {
          next = applyStatus(next, enemy.id, "weakened", ability.statusDuration ?? 2, actor.id);
          next = applyStatus(next, enemy.id, "frightened", ability.statusDuration ?? 2, actor.id);
          next = applyKnockback(next, actor, enemy.id);
        } else next = applyStatus(next, enemy.id, "exposed", 1, actor.id);
      }
      return next;
    }
    return resolveStatus(state, random, actor, target, ability);
  }
  if (ability.kind === "damage") return resolveDamage(state, random, actor, ability, [target]);
  if (ability.kind !== "attack") return state;

  let positioned = state;
  let currentActor = actor;
  if (ability.special === "reckless-charge" && distance(actor.position, target.position) > 1) {
    const destination = adjacentFreeCell(state, target.position, actor.position);
    if (destination) {
      positioned = updateUnit(positioned, actor.id, (unit) => ({ ...unit, position: destination, moved: true }));
      currentActor = positioned.combatants.find((unit) => unit.id === actor.id)!;
    }
  }
  const roll = random.int(1, 20);
  const modifier = attackModifier(positioned, currentActor, ability, target);
  const defense = effectiveDefense(positioned, target, ability);
  const hit = roll === 20 || (roll !== 1 && roll + modifier >= defense);
  let next = appendLog(positioned, `${actor.name}: d20 ${roll} + ${modifier} przeciw Obronie ${defense} — ${hit ? "trafienie" : "pudło"}.`, "roll");
  if (!hit) return ability.special === "reckless-charge" ? applyStatus(next, actor.id, "exposed", 2, actor.id) : next;
  let damage = rollDamage(random, ability, roll === 20) + (hasStatus(currentActor, "raging") ? 3 : 0);
  if (ability.special === "smite-evil" && ["undead", "evil", "elite", "boss"].some((tag) => target.tags.includes(tag))) damage += rollDice(random, 1, 8).total;
  next = dealDamage(next, target.id, damage, ability.damageType ?? "slashing", isRangedAttack(ability));
  next = appendLog(next, `${ability.name} zadaje ${damage}${roll === 20 ? " (krytyk)" : ""}.`, "damage");
  if (ability.status) {
    if (ability.special === "quivering-palm" && target.tags.includes("boss")) next = applyStatus(next, target.id, "weakened", ability.statusDuration ?? 2, actor.id);
    else next = resolveStatus(next, random, actor, target, ability);
  }
  if (ability.id === "cleave") {
    const secondary = state.combatants.find((unit) => unit.hp > 0 && unit.side !== actor.side && unit.id !== target.id && distance(unit.position, target.position) <= 1);
    if (secondary) { next = dealDamage(next, secondary.id, damage, ability.damageType ?? "slashing", false); next = appendLog(next, `Cleave dosięga ${secondary.name}: ${damage} obrażeń.`, "damage"); }
  }
  if (ability.special === "reckless-charge") next = applyStatus(next, actor.id, "exposed", 2, actor.id);
  if (ability.special === "thorn-lash") next = applyPull(next, actor, target.id);
  if (ability.special === "evasive-retreat") next = applyStatus(next, actor.id, "swift", 2, actor.id);
  if ((actor.definitionId === "ogre" && ability.id === "greatclub") || ability.id === "gore-charge") next = applyKnockback(next, actor, target.id);
  next = recoverSorcererChargeOnKill(next, actor, target.id);
  return next;
}

function switchHeroWeapon(state: BattleState, actor: Combatant): BattleState {
  const profileId = Object.keys(state.heroLoadoutSnapshots ?? {}).find((id) => `hero-${id}` === actor.id);
  const loadout = profileId ? state.heroLoadoutSnapshots?.[profileId] : undefined;
  const profile = profileId ? state.heroSnapshots?.find((candidate) => candidate.id === profileId) : undefined;
  if (!profileId || !profile || !loadout?.backupWeapon) return appendLog(state, `${actor.name} nie ma broni zapasowej.`, "system");
  const switched = { ...loadout, weapon: loadout.backupWeapon, backupWeapon: loadout.weapon };
  const nextSwitch = weaponSwitchAbility(actor.definitionId, switched);
  const definition = heroBattleStats(profile);
  const bonuses = equipmentBonuses(switched);
  const basicAttack = basicAttackForLoadout(definition, profile.level, switched, bonuses.attack);
  const next = updateUnit({ ...state, heroLoadoutSnapshots: { ...(state.heroLoadoutSnapshots ?? {}), [profileId]: switched } }, actor.id, (unit) => ({
    ...unit,
    attackBonus: definition.attackBonus + bonuses.attack,
    basicAttack,
    abilities: unit.abilities.map((candidate) => candidate.special === "switch-weapon" && nextSwitch ? nextSwitch : candidate),
  }));
  return appendLog(next, `${actor.name} dobywa ${basicAttack.name}.`, "system");
}

function resolveCellAbility(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, ability: AbilityDefinition, position: GridPosition): BattleState {
  if (ability.special === "set-snare") {
    const trap = { id: `snare-${actor.id}-${state.round}`, position, sourceId: actor.id, damage: 4, remainingRounds: 4 };
    return appendLog({ ...state, traps: [...(state.traps ?? []).filter((item) => positionKey(item.position) !== positionKey(position)), trap] }, `${actor.name} zastawia sidła.`, "system");
  }
  const area = ability.area ?? 0;
  const recipients = state.combatants.filter((unit) => unit.hp > 0 && unit.side !== actor.side && distance(position, unit.position) <= area && hasLineOfSight(state.map, position, unit.position));
  let next = appendLog(state, `${actor.name} używa ${ability.name} na polu ${position.x},${position.y}.`, "system");
  if (ability.special === "entangle") next = { ...next, map: { ...next.map, cells: next.map.cells.map((cell) => distance(cell.position, position) <= area && cell.terrain === "floor" ? { ...cell, terrain: "difficult" as const } : cell) } };
  if (ability.kind === "damage") return resolveDamage(next, random, actor, ability, recipients);
  if (ability.kind === "status") for (const recipient of recipients) next = resolveStatus(next, random, actor, recipient, ability);
  return next;
}

function resolveObjectiveAttack(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, ability: AbilityDefinition, objectiveId: string): BattleState {
  const objective = state.objectives.find((item) => item.id === objectiveId)!;
  const roll = random.int(1, 20);
  const modifier = attackModifier(state, actor, ability);
  const defense = 10 + (isRangedAttack(ability) && terrainAt(state.map, objective.position) === "cover" ? 2 : 0);
  const hit = roll === 20 || (roll !== 1 && roll + modifier >= defense);
  const damage = hit ? rollDamage(random, ability, roll === 20) : 0;
  let next = { ...state, objectives: state.objectives.map((item) => item.id === objectiveId ? { ...item, hp: Math.max(0, item.hp - damage) } : item) };
  return appendLog(next, `${actor.name} atakuje ${state.scenario.objectiveLabel ?? "ognisko"}: d20 ${roll} + ${modifier} przeciw Obronie ${defense} — ${hit ? `${damage} obrażeń` : "pudło"}.`, "roll");
}

function resolveMovementAbility(state: BattleState, actor: Combatant, ability: AbilityDefinition, position: GridPosition): BattleState {
  const moved = moveCombatant(state, actor.id, position);
  const updated = moved.combatants.find((unit) => unit.id === actor.id);
  return updated?.moved ? consumeAbility(moved, actor.id, ability, state.round) : moved;
}

function resolveDamage(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, ability: AbilityDefinition, targets: Combatant[]): BattleState {
  let next = state;
  const surge = hasStatus(actor, "surging") && ability.tags?.includes("spell") ? 3 : 0;
  for (const target of targets) {
    const saved = ability.save ? savingThrow(random, target, ability.save, 13) : false;
    const damage = Math.max(1, Math.floor((rollDamage(random, ability, false) + surge) * (saved ? 0.5 : 1)));
    next = dealDamage(next, target.id, damage, ability.damageType ?? "force", ability.tags?.includes("ranged") ?? false);
    if (ability.status && !saved) next = applyStatus(next, target.id, ability.status, ability.statusDuration ?? 2, actor.id);
    next = appendLog(next, `${actor.name}: ${ability.name} zadaje ${damage} (${target.name})${saved ? " po udanym rzucie obronnym" : ""}.`, "damage");
    next = recoverSorcererChargeOnKill(next, actor, target.id);
  }
  if (surge) next = updateUnit(next, actor.id, (unit) => ({ ...unit, statuses: unit.statuses.filter((status) => status.id !== "surging") }));
  return next;
}

function applyTurnStart(state: BattleState): BattleState {
  const active = activeCombatant(state);
  if (!active) return state;
  let next = state;
  let hp = active.hp;
  if (terrainAt(state.map, active.position) === "hazard") {
    hp -= 2;
    next = appendLog(next, `${active.name} otrzymuje 2 obrażenia od niebezpiecznego terenu.`, "damage");
  }
  if (hasStatus(active, "burning")) hp -= 2;
  if (hasStatus(active, "poisoned")) hp -= 1;
  if ((hasStatus(active, "regenerating") || active.tags.includes("regeneration")) && !hasStatus(active, "burning")) hp = Math.min(active.maxHp, hp + 2);
  next = updateUnit(next, active.id, (unit) => ({ ...unit, hp: Math.max(0, hp), acted: hasStatus(unit, "stunned") }));
  if (hp !== active.hp && terrainAt(state.map, active.position) !== "hazard") next = appendLog(next, `${active.name} rozpoczyna turę z ${Math.max(0, hp)} HP.`, "status");
  next = evaluateOutcome(next);
  const updatedActive = activeCombatant(next);
  return updatedActive && updatedActive.hp <= 0 && next.outcome === "active" ? endActivation(next) : next;
}

function isLegalUnitTarget(state: BattleState, actor: Combatant, ability: AbilityDefinition, target: Combatant): boolean {
  if ((target.hp <= 0 && ability.special !== "lay-hands") || distance(actor.position, target.position) > ability.range) return false;
  if (ability.target === "ally" && actor.side !== target.side) return false;
  if (ability.target === "enemy" && actor.side === target.side) return false;
  if (ability.id === "turn-undead" && !target.tags.includes("undead")) return false;
  if (ability.id === "sneak-attack" && !isFlanking(state, actor.id, target.id)) return false;
  return !requiresLineOfSight(ability) || hasLineOfSight(state.map, actor.position, target.position);
}

function effectiveDefense(state: BattleState, target: Combatant, ability: AbilityDefinition): number {
  const guarded = hasStatus(target, "guarded") ? 2 : 0;
  const armoredVanguard = target.definitionId === "fighter" && state.combatants.some((unit) => unit.id !== target.id && unit.side === target.side && unit.hp > 0 && distance(unit.position, target.position) === 1) ? 1 : 0;
  const cover = isRangedAttack(ability) && terrainAt(state.map, target.position) === "cover" ? 2 : 0;
  const exposed = hasStatus(target, "exposed") || hasStatus(target, "raging") ? 2 : 0;
  return target.defenseClass + guarded + armoredVanguard + cover - exposed;
}

function attackModifier(state: BattleState, actor: Combatant, ability: AbilityDefinition, target?: Combatant): number {
  const blessed = hasStatus(actor, "blessed") ? 1 : 0;
  const inspired = hasStatus(actor, "inspired") ? 1 : 0;
  const raging = hasStatus(actor, "raging") ? 2 : 0;
  const wild = hasStatus(actor, "wild-shaped") ? 2 : 0;
  const frightened = hasStatus(actor, "frightened") ? 2 : 0;
  const poisoned = hasStatus(actor, "poisoned") ? 1 : 0;
  const weakened = hasStatus(actor, "weakened") || hasStatus(actor, "quivering") ? 2 : 0;
  const hunted = target && hasStatus(target, "hunted") ? 1 : 0;
  const challenge = actor.statuses.find((status) => status.id === "challenged");
  const challenged = challenge && target && challenge.sourceId !== target.id ? 2 : 0;
  const highGround = terrainAt(state.map, actor.position) === "highGround" ? 1 : 0;
  return (ability.attackBonusOverride ?? actor.attackBonus) + blessed + inspired + raging + wild + hunted - frightened - poisoned - weakened - challenged + highGround;
}

function applyKnockback(state: BattleState, actor: Combatant, targetId: string): BattleState {
  const target = state.combatants.find((unit) => unit.id === targetId);
  if (!target || target.hp <= 0) return state;
  const destination = { x: target.position.x + Math.sign(target.position.x - actor.position.x), y: target.position.y + Math.sign(target.position.y - actor.position.y) };
  const occupied = state.combatants.some((unit) => unit.id !== target.id && unit.hp > 0 && positionKey(unit.position) === positionKey(destination));
  if (occupied || !terrainAt(state.map, destination) || terrainAt(state.map, destination) === "wall") return appendLog(state, `${target.name} opiera się odrzuceniu.`, "status");
  return appendLog(updateUnit(state, target.id, (unit) => ({ ...unit, position: destination })), `${actor.name} odrzuca ${target.name} o 1 pole.`, "status");
}

function applyPull(state: BattleState, actor: Combatant, targetId: string): BattleState {
  const target = state.combatants.find((unit) => unit.id === targetId);
  if (!target || target.hp <= 0 || distance(actor.position, target.position) <= 1) return state;
  const destination = { x: target.position.x + Math.sign(actor.position.x - target.position.x), y: target.position.y + Math.sign(actor.position.y - target.position.y) };
  const occupied = state.combatants.some((unit) => unit.id !== target.id && unit.hp > 0 && positionKey(unit.position) === positionKey(destination));
  if (occupied || !terrainAt(state.map, destination) || terrainAt(state.map, destination) === "wall") return state;
  return appendLog(updateUnit(state, target.id, (unit) => ({ ...unit, position: destination })), `${actor.name} przyciąga ${target.name} o 1 pole.`, "status");
}

function applyAreaStatus(state: BattleState, actor: Combatant, ability: AbilityDefinition, group: "allies" | "enemies", statuses: StatusId[]): BattleState {
  let next = state;
  for (const unit of state.combatants.filter((candidate) => candidate.hp > 0 && (group === "allies" ? candidate.side === actor.side : candidate.side !== actor.side) && distance(actor.position, candidate.position) <= (ability.area ?? 0))) {
    for (const status of statuses) next = applyStatus(next, unit.id, status, ability.statusDuration ?? 2, actor.id);
  }
  return appendLog(next, `${actor.name} używa ${ability.name}.`, "status");
}

function summonWolf(state: BattleState, actor: Combatant): BattleState {
  const wolf = monsterById.get("dire-wolf");
  const position = adjacentFreeCell(state, actor.position);
  if (!wolf || !position) return appendLog(state, "Brak miejsca na przyzwanie wilka.", "system");
  const id = `summon-${actor.id}-${state.round}`;
  const summoned: Combatant = {
    id, definitionId: wolf.id, name: `Wilk ${actor.name}`, side: actor.side, position,
    hp: wolf.maxHp, maxHp: wolf.maxHp, defenseClass: wolf.defenseClass, saves: wolf.saves,
    speed: wolf.speed, initiativeBonus: wolf.initiative, initiative: actor.initiative - 1,
    attackBonus: wolf.attackBonus, basicAttack: wolf.basicAttack, abilities: [], charges: 0, maxCharges: 0,
    cooldowns: {}, statuses: [{ id: "summoned", remainingRounds: 3, sourceId: actor.id }], doctrine: "skirmisher",
    resistances: wolf.resistances ?? [], tags: [...(wolf.tags ?? []), "summoned"], moved: false, acted: false,
  };
  return appendLog({ ...state, combatants: [...state.combatants, summoned], initiativeOrder: [...state.initiativeOrder, id] }, `${actor.name} przyzywa wilka na 3 rundy.`, "system");
}

function adjacentFreeCell(state: BattleState, center: GridPosition, preferred?: GridPosition): GridPosition | undefined {
  const occupied = new Set(state.combatants.filter((unit) => unit.hp > 0).map((unit) => positionKey(unit.position)));
  return state.map.cells
    .filter((cell) => distance(cell.position, center) === 1 && cell.terrain !== "wall" && !occupied.has(positionKey(cell.position)))
    .sort((left, right) => preferred ? distance(left.position, preferred) - distance(right.position, preferred) : 0)
    .at(0)?.position;
}

function triggerTrap(state: BattleState, combatantId: string): BattleState {
  const unit = state.combatants.find((candidate) => candidate.id === combatantId);
  if (!unit) return state;
  const trap = (state.traps ?? []).find((candidate) => positionKey(candidate.position) === positionKey(unit.position));
  if (!trap) return state;
  const source = state.combatants.find((candidate) => candidate.id === trap.sourceId);
  if (!source || source.side === unit.side) return state;
  let next: BattleState = { ...state, traps: (state.traps ?? []).filter((candidate) => candidate.id !== trap.id) };
  next = dealDamage(next, unit.id, trap.damage, "piercing", false);
  next = applyStatus(next, unit.id, "webbed", 2, trap.sourceId);
  return appendLog(next, `${unit.name} wpada w sidła: ${trap.damage} obrażenia i Webbed.`, "damage");
}

function consumeAbility(state: BattleState, actorId: string, ability: AbilityDefinition, round: number): BattleState {
  return updateUnit(state, actorId, (unit) => ({ ...unit, charges: unit.charges - ability.resourceCost, cooldowns: startAbilityCooldown(unit, ability, round), acted: true }));
}

function requiresLineOfSight(ability: AbilityDefinition): boolean { return ability.kind !== "move" && ability.target !== "self" && ability.range > 1; }
function isRangedAttack(ability: AbilityDefinition): boolean { return ability.kind === "attack" && ability.range > 1; }
function findAbility(actor: Combatant, abilityId: string): AbilityDefinition | undefined { return [actor.basicAttack, ...actor.abilities].find((ability) => ability.id === abilityId); }
function sameTarget(left: ActionTarget, right: ActionTarget): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "self") return true;
  if (left.kind === "unit" && right.kind === "unit") return left.unitId === right.unitId;
  if (left.kind === "objective" && right.kind === "objective") return left.objectiveId === right.objectiveId;
  return left.kind === "cell" && right.kind === "cell" && positionKey(left.position) === positionKey(right.position);
}
function resolveStatus(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, target: Combatant, ability: AbilityDefinition): BattleState { if (!ability.status) return state; const saved = ability.save ? savingThrow(random, target, ability.save, 13) : false; return saved ? appendLog(state, `${target.name} odpiera efekt ${ability.name} (ST 13).`, "roll") : applyStatus(appendLog(state, `${target.name}: ${ability.status}.`, "status"), target.id, ability.status, ability.statusDuration ?? 2, actor.id); }
function savingThrow(random: ReturnType<typeof createRandom>, target: Combatant, save: keyof Combatant["saves"], dc: number): boolean { return random.int(1, 20) + target.saves[save] >= dc; }
function rollDamage(random: ReturnType<typeof createRandom>, ability: AbilityDefinition, critical: boolean): number { const dice = ability.damage ?? { count: 1, sides: 4 }; return rollDice(random, dice.count * (critical ? 2 : 1), dice.sides).total + (dice.bonus ?? 0); }
function hasStatus(unit: Combatant, id: StatusId): boolean { return unit.statuses.some((status) => status.id === id); }
function applyStatus(state: BattleState, id: string, status: StatusId, rounds: number, sourceId?: string): BattleState {
  return updateUnit(state, id, (unit) => {
    if (hasStatus(unit, "raging") && ["frightened", "stunned", "webbed", "prone"].includes(status)) return unit;
    if (hasStatus(unit, "protected") && status === "frightened") return unit;
    return { ...unit, statuses: [...unit.statuses.filter((item) => item.id !== status), { id: status, remainingRounds: rounds, sourceId }] };
  });
}
function updateUnit(state: BattleState, id: string, updater: (unit: Combatant) => Combatant): BattleState { return { ...state, combatants: state.combatants.map((unit) => unit.id === id ? updater(unit) : unit) }; }
function dealDamage(state: BattleState, id: string, rawDamage: number, type: DamageType, ranged: boolean): BattleState {
  return updateUnit(state, id, (unit) => {
    const resistance = unit.resistances.includes(type) ? 0.5 : 1;
    const protection = hasStatus(unit, "protected") ? 2 : 0;
    const deflect = ranged && hasStatus(unit, "deflecting") && unit.reactionUsedRound !== state.round ? 6 : 0;
    const damage = Math.max(1, Math.floor(rawDamage * resistance) - protection - deflect);
    return { ...unit, hp: Math.max(0, unit.hp - damage), reactionUsedRound: deflect ? state.round : unit.reactionUsedRound };
  });
}
function recoverSorcererChargeOnKill(state: BattleState, actor: Combatant, targetId: string): BattleState {
  const target = state.combatants.find((unit) => unit.id === targetId);
  if (actor.definitionId !== "sorcerer" || !target || target.hp > 0) return state;
  return updateUnit(state, actor.id, (unit) => ({ ...unit, charges: Math.min(unit.maxCharges, unit.charges + 1) }));
}
function removeOneNegativeStatus(statuses: Combatant["statuses"]): Combatant["statuses"] {
  const negative: StatusId[] = ["poisoned", "burning", "frightened", "prone", "stunned", "webbed", "fatigued", "exposed", "weakened", "quivering"];
  const index = statuses.findIndex((status) => negative.includes(status.id));
  return index < 0 ? statuses : statuses.filter((_, statusIndex) => statusIndex !== index);
}
function appendLog(state: BattleState, text: string, kind: BattleState["log"][number]["kind"]): BattleState { return { ...state, log: [...state.log.slice(-59), { id: (state.log.at(-1)?.id ?? 0) + 1, text, kind }] }; }
function startAbilityCooldown(actor: Combatant, ability: AbilityDefinition, round: number): Record<string, number> { const cooldown = ability.cooldown ?? (ability.resourceCost > 0 ? 2 : 0); return cooldown > 0 ? { ...(actor.cooldowns ?? {}), [ability.id]: round + cooldown } : actor.cooldowns ?? {}; }

export function evaluateOutcome(state: BattleState): BattleState {
  const heroesAlive = state.combatants.some((unit) => unit.side === "heroes" && unit.hp > 0);
  let outcome: BattleState["outcome"] = "active";
  if (!heroesAlive) outcome = "defeat";
  else if (state.scenario.victoryCondition === "template-rules") {
    if (state.scenario.victoryRules && isScenarioConditionMet(state, state.scenario.victoryRules)) outcome = "victory";
    else if (state.scenario.defeatRules && isScenarioConditionMet(state, state.scenario.defeatRules)) outcome = "defeat";
  }
  else if (state.scenario.victoryCondition === "defeat-ritualist") {
    const ritualistAlive = state.combatants.some((unit) => unit.tags.includes("ritualist") && unit.hp > 0);
    outcome = !ritualistAlive ? "victory" : state.scenario.roundLimit && state.round > state.scenario.roundLimit ? "defeat" : "active";
  } else if (state.scenario.victoryCondition === "destroy-foci-and-undead") {
    const undeadAlive = state.combatants.some((unit) => unit.side === "monsters" && unit.hp > 0 && unit.tags.includes("undead"));
    const objectivesAlive = state.objectives.some((objective) => objective.hp > 0);
    outcome = !undeadAlive && !objectivesAlive ? "victory" : "active";
  }
  return { ...state, outcome };
}
