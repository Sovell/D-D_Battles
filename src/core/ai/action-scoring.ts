import type { AbilityDefinition, ActionTarget, BattleState, Combatant, GridPosition } from "../domain/types";
import { activeCombatant, endActivation, getLegalTargets, resolveAbility, moveCombatant } from "../rules/combat";
import { distance, findPath, getReachableCells, positionKey } from "../rules/pathfinding";

export type AiAction = { kind: "attack"; abilityId: string; target: ActionTarget } | { kind: "move"; position: GridPosition } | { kind: "end" };

export function chooseAiAction(state: BattleState): AiAction {
  const actor = activeCombatant(state);
  if (!actor || actor.side !== "monsters") return { kind: "end" };
  const heroes = state.combatants.filter((unit) => unit.side === "heroes" && unit.hp > 0);
  const candidates = [actor.basicAttack, ...actor.abilities].flatMap((ability) => getLegalTargets(state, actor.id, ability.id).map((target) => ({ ability, target, score: scoreAction(state, actor, ability, target) })));
  const best = candidates.sort((a, b) => b.score - a.score || a.ability.id.localeCompare(b.ability.id))[0];
  if (best) return { kind: "attack", abilityId: best.ability.id, target: best.target };
  const cells = getReachableCells(state, actor.id);
  if (!actor.moved && cells.length && heroes.length) {
    const target = [...heroes].sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0];
    const reachable = new Set(cells.map(positionKey));
    const path = findPath(state.map, actor.position, target.position) ?? [];
    const position = [...path].reverse().find((cell) => reachable.has(positionKey(cell))) ?? [...cells].sort((a, b) => distance(a, target.position) - distance(b, target.position))[0];
    return { kind: "move", position };
  }
  return { kind: "end" };
}

export function runAiStep(state: BattleState): BattleState {
  const actor = activeCombatant(state);
  if (!actor) return state;
  const action = chooseAiAction(state);
  if (action.kind === "attack") return resolveAbility(state, actor.id, action.abilityId, action.target);
  if (action.kind === "move") return moveCombatant(state, actor.id, action.position);
  return endActivation(state);
}

function scoreAction(state: BattleState, actor: Combatant, ability: AbilityDefinition, target: ActionTarget): number {
  const expectedDamage = ability.damage ? ability.damage.count * (ability.damage.sides + 1) / 2 + (ability.damage.bonus ?? 0) : 0;
  if (target.kind === "cell") {
    const victims = state.combatants.filter((unit) => unit.side !== actor.side && unit.hp > 0 && distance(unit.position, target.position) <= (ability.area ?? 0)).length;
    return victims * (expectedDamage + (ability.status ? 4 : 0)) - (victims === 0 ? 20 : 0);
  }
  if (target.kind !== "unit") return expectedDamage;
  const unit = state.combatants.find((candidate) => candidate.id === target.unitId);
  if (!unit) return -100;
  if (unit.side === actor.side) return ability.status && !unit.statuses.some((item) => item.id === ability.status) ? 3 : -10;
  return scoreTarget(actor, unit) + expectedDamage + (ability.status ? 4 : 0) + (ability.range > 1 ? 0.5 : 0);
}

function scoreTarget(actor: Combatant, target: Combatant): number {
  const wounded = 1 - target.hp / target.maxHp;
  const doctrine = actor.doctrine === "brute" ? target.maxHp / 10 : actor.doctrine === "controller" ? target.abilities.length : 0;
  return wounded * 10 + doctrine - target.defenseClass * 0.1;
}
