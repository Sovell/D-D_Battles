import type { AbilityDefinition, BattleState, Combatant, DamageType, GridPosition, StatusId } from "../domain/types";
import { createRandom, rollDice } from "../random/random";
import { distance, getReachableCells, positionKey } from "./pathfinding";

export function moveCombatant(state: BattleState, combatantId: string, position: GridPosition): BattleState {
  const legal = getReachableCells(state, combatantId).some((cell) => positionKey(cell) === positionKey(position));
  if (!legal) return appendLog(state, "Nielegalny ruch.", "system");
  return { ...state, combatants: state.combatants.map((unit) => unit.id === combatantId ? { ...unit, position, moved: true } : unit) };
}

export function useAbility(state: BattleState, actorId: string, abilityId: string, targetId: string): BattleState {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const target = state.combatants.find((unit) => unit.id === targetId);
  if (!actor || actor.hp <= 0 || actor.acted || !target || target.hp <= 0) return appendLog(state, "Akcja jest niedostępna.", "system");
  const ability = [actor.basicAttack, ...actor.abilities].find((candidate) => candidate.id === abilityId);
  if (!ability || !canTargetWithAbility(state, actorId, abilityId, targetId)) return appendLog(state, "Nielegalny cel lub brak zasobów.", "system");

  const random = createRandom(state.randomState);
  let next = state;
  if (ability.kind === "heal") {
    const healing = rollDamage(random, ability, false);
    next = updateUnit(next, target.id, (unit) => ({ ...unit, hp: Math.min(unit.maxHp, unit.hp + healing) }));
    next = appendLog(next, `${actor.name} używa ${ability.name}: ${target.name} odzyskuje ${healing} HP.`, "damage");
  } else if (ability.kind === "status" && ability.target !== "self") {
    const center = ability.id === "turn-undead" ? actor.position : target.position;
    const targets = ability.area
      ? state.combatants.filter((unit) => unit.hp > 0 && unit.side !== actor.side && distance(center, unit.position) <= ability.area! && (ability.id !== "turn-undead" || unit.tags.includes("undead")))
      : [target];
    for (const recipient of targets) next = resolveStatus(next, random, actor, recipient, ability);
  } else if (ability.kind === "status") {
    next = applyStatus(next, actor.id, ability.status!, 1);
  } else if (ability.kind === "damage") {
    const targets = ability.area ? state.combatants.filter((unit) => unit.hp > 0 && unit.side !== actor.side && distance(target.position, unit.position) <= ability.area!) : [target];
    for (const recipient of targets) {
      const saved = ability.save ? savingThrow(random, recipient, ability.save, 13) : false;
      const damage = Math.max(1, Math.floor(rollDamage(random, ability, false) * (saved ? 0.5 : 1)));
      next = dealDamage(next, recipient.id, damage, ability.damageType ?? "force");
      if (ability.status && !saved) next = applyStatus(next, recipient.id, ability.status, 2);
      next = appendLog(next, `${actor.name}: ${ability.name} zadaje ${damage} (${recipient.name})${saved ? " po udanym rzucie obronnym" : ""}.`, "damage");
    }
  } else {
    const roll = random.int(1, 20);
    const modifier = actor.attackBonus + (hasStatus(actor, "blessed") ? 1 : 0) - (hasStatus(actor, "frightened") || hasStatus(actor, "poisoned") ? 1 : 0);
    const defense = target.defenseClass + (hasStatus(target, "guarded") ? 2 : 0);
    const hit = roll === 20 || (roll !== 1 && roll + modifier >= defense);
    next = appendLog(next, `${actor.name}: d20 ${roll} + ${modifier} przeciw DC ${defense} — ${hit ? "trafienie" : "pudło"}.`, "roll");
    if (hit) {
      const damage = rollDamage(random, ability, roll === 20);
      next = dealDamage(next, target.id, damage, ability.damageType ?? "slashing");
      next = appendLog(next, `${ability.name} zadaje ${damage}${roll === 20 ? " (krytyk)" : ""}.`, "damage");
      if (ability.status) next = resolveStatus(next, random, actor, target, ability);
      if (ability.id === "cleave") {
        const secondary = state.combatants.find((unit) => unit.hp > 0 && unit.side !== actor.side && unit.id !== target.id && distance(unit.position, target.position) <= 1);
        if (secondary) { next = dealDamage(next, secondary.id, damage, ability.damageType ?? "slashing"); next = appendLog(next, `Cleave dosięga ${secondary.name}: ${damage} obrażeń.`, "damage"); }
      }
    }
  }
  next = updateUnit(next, actor.id, (unit) => ({ ...unit, charges: unit.charges - ability.resourceCost, cooldowns: startAbilityCooldown(unit, ability.id, ability.resourceCost, state.round), acted: true }));
  return { ...evaluateOutcome(next), randomState: random.state };
}

export function canTargetWithAbility(state: BattleState, actorId: string, abilityId: string, targetId: string): boolean {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const target = state.combatants.find((unit) => unit.id === targetId);
  const ability = actor && [actor.basicAttack, ...actor.abilities].find((candidate) => candidate.id === abilityId);
  return Boolean(actor && actor.hp > 0 && !actor.acted && target && target.hp > 0 && ability && actor.charges >= ability.resourceCost && abilityCooldownRemaining(state, actor.id, ability.id) === 0 && distance(actor.position, target.position) <= ability.range && validTarget(actor, target, ability));
}

export function abilityCooldownRemaining(state: BattleState, actorId: string, abilityId: string): number {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  return Math.max(0, (actor?.cooldowns?.[abilityId] ?? 0) - state.round);
}

export function attackObjective(state: BattleState, actorId: string, objectiveId: string): BattleState {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const objective = state.objectives.find((item) => item.id === objectiveId);
  if (!actor || !objective || actor.acted || objective.hp <= 0 || distance(actor.position, objective.position) > 1) return state;
  const random = createRandom(state.randomState);
  const roll = random.int(1, 20);
  const hit = roll !== 1 && (roll === 20 || roll + actor.attackBonus >= 10);
  const damage = hit ? rollDamage(random, actor.basicAttack, roll === 20) : 0;
  let next = { ...state, randomState: random.state, objectives: state.objectives.map((item) => item.id === objectiveId ? { ...item, hp: Math.max(0, item.hp - damage) } : item) };
  next = updateUnit(next, actor.id, (unit) => ({ ...unit, acted: true }));
  next = appendLog(next, `${actor.name} atakuje ognisko: ${hit ? `${damage} obrażeń` : "pudło"}.`, "roll");
  return evaluateOutcome(next);
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
    ? activated.map((unit) => ({ ...unit, moved: false, acted: false, statuses: unit.statuses.map((status) => ({ ...status, remainingRounds: status.remainingRounds - 1 })).filter((status) => status.remainingRounds > 0) }))
    : activated;
  let next = { ...state, activeIndex: nextIndex, round, combatants };
  return applyTurnStart(next);
}

export function activeCombatant(state: BattleState): Combatant | undefined { return state.combatants.find((unit) => unit.id === state.initiativeOrder[state.activeIndex]); }

export function useMovementAbility(state: BattleState, actorId: string, abilityId: string, position: GridPosition): BattleState {
  const actor = state.combatants.find((unit) => unit.id === actorId);
  const ability = actor?.abilities.find((candidate) => candidate.id === abilityId && candidate.kind === "move");
  if (!actor || !ability || actor.acted || actor.charges < ability.resourceCost || abilityCooldownRemaining(state, actorId, abilityId) > 0 || distance(actor.position, position) > ability.range) return appendLog(state, "Ta zdolność ruchowa jest niedostępna.", "system");
  const moved = moveCombatant(state, actorId, position);
  const updated = moved.combatants.find((unit) => unit.id === actorId);
  if (!updated?.moved) return moved;
  return { ...moved, combatants: moved.combatants.map((unit) => unit.id === actorId ? { ...unit, charges: unit.charges - ability.resourceCost, cooldowns: startAbilityCooldown(unit, ability.id, ability.resourceCost, state.round), acted: true } : unit) };
}

function applyTurnStart(state: BattleState): BattleState {
  const active = activeCombatant(state);
  if (!active) return state;
  let hp = active.hp;
  if (hasStatus(active, "burning")) hp -= 2;
  if (hasStatus(active, "poisoned")) hp -= 1;
  if (hasStatus(active, "regenerating")) hp = Math.min(active.maxHp, hp + 2);
  let next = updateUnit(state, active.id, (unit) => ({ ...unit, hp: Math.max(0, hp), acted: hasStatus(unit, "stunned") }));
  if (hp !== active.hp) next = appendLog(next, `${active.name} rozpoczyna turę z ${Math.max(0, hp)} HP.`, "status");
  next = evaluateOutcome(next);
  const updatedActive = activeCombatant(next);
  return updatedActive && updatedActive.hp <= 0 && next.outcome === "active" ? endActivation(next) : next;
}

function resolveStatus(state: BattleState, random: ReturnType<typeof createRandom>, actor: Combatant, target: Combatant, ability: AbilityDefinition): BattleState {
  if (!ability.status) return state;
  const saved = ability.save ? savingThrow(random, target, ability.save, 13) : false;
  if (saved) return appendLog(state, `${target.name} odpiera efekt ${ability.name}.`, "roll");
  return applyStatus(appendLog(state, `${target.name}: ${ability.status}.`, "status"), target.id, ability.status, 2);
}

function savingThrow(random: ReturnType<typeof createRandom>, target: Combatant, save: keyof Combatant["saves"], dc: number): boolean { return random.int(1, 20) + target.saves[save] >= dc; }
function rollDamage(random: ReturnType<typeof createRandom>, ability: AbilityDefinition, critical: boolean): number { const dice = ability.damage ?? { count: 1, sides: 4 }; return rollDice(random, dice.count * (critical ? 2 : 1), dice.sides).total + (dice.bonus ?? 0); }
function validTarget(actor: Combatant, target: Combatant, ability: AbilityDefinition): boolean { return ability.target === "self" ? actor.id === target.id : ability.target === "ally" ? actor.side === target.side : ability.target === "enemy" ? actor.side !== target.side : true; }
function startAbilityCooldown(actor: Combatant, abilityId: string, resourceCost: number, round: number): Record<string, number> { return resourceCost > 0 ? { ...(actor.cooldowns ?? {}), [abilityId]: round + 2 } : actor.cooldowns ?? {}; }
function hasStatus(unit: Combatant, id: StatusId): boolean { return unit.statuses.some((status) => status.id === id); }
function applyStatus(state: BattleState, id: string, status: StatusId, rounds: number): BattleState { return updateUnit(state, id, (unit) => ({ ...unit, statuses: [...unit.statuses.filter((item) => item.id !== status), { id: status, remainingRounds: rounds }] })); }
function updateUnit(state: BattleState, id: string, updater: (unit: Combatant) => Combatant): BattleState { return { ...state, combatants: state.combatants.map((unit) => unit.id === id ? updater(unit) : unit) }; }
function dealDamage(state: BattleState, id: string, rawDamage: number, type: DamageType): BattleState { return updateUnit(state, id, (unit) => ({ ...unit, hp: Math.max(0, unit.hp - Math.max(1, Math.floor(rawDamage * (unit.resistances.includes(type) ? 0.5 : 1)))) })); }
function appendLog(state: BattleState, text: string, kind: BattleState["log"][number]["kind"]): BattleState { return { ...state, log: [...state.log.slice(-59), { id: (state.log.at(-1)?.id ?? 0) + 1, text, kind }] }; }
export function evaluateOutcome(state: BattleState): BattleState {
  const heroesAlive = state.combatants.some((unit) => unit.side === "heroes" && unit.hp > 0);
  let outcome: BattleState["outcome"] = "active";
  if (!heroesAlive) outcome = "defeat";
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
