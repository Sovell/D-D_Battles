import type { ActionTarget, BattleState, Combatant, GridPosition } from "../domain/types";
import { activeCombatant, endActivation, getLegalTargets, resolveAbility, moveCombatant } from "../rules/combat";
import { distance, findPath, getReachableCells, positionKey } from "../rules/pathfinding";

export type AiAction = { kind: "attack"; target: ActionTarget } | { kind: "move"; position: GridPosition } | { kind: "end" };

export function chooseAiAction(state: BattleState): AiAction {
  const actor = activeCombatant(state);
  if (!actor || actor.side !== "monsters") return { kind: "end" };
  const heroes = state.combatants.filter((unit) => unit.side === "heroes" && unit.hp > 0);
  const legalUnitIds = new Set(getLegalTargets(state, actor.id, actor.basicAttack.id).flatMap((target) => target.kind === "unit" ? [target.unitId] : []));
  const inRange = heroes.filter((target) => legalUnitIds.has(target.id));
  if (inRange.length) {
    const target = [...inRange].sort((a, b) => scoreTarget(actor, b) - scoreTarget(actor, a))[0];
    return { kind: "attack", target: { kind: "unit", unitId: target.id } };
  }
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
  if (action.kind === "attack") return resolveAbility(state, actor.id, actor.basicAttack.id, action.target);
  if (action.kind === "move") return moveCombatant(state, actor.id, action.position);
  return endActivation(state);
}

function scoreTarget(actor: Combatant, target: Combatant): number {
  const wounded = 1 - target.hp / target.maxHp;
  const doctrine = actor.doctrine === "brute" ? target.maxHp / 10 : actor.doctrine === "controller" ? target.abilities.length : 0;
  return wounded * 10 + doctrine - target.defenseClass * 0.1;
}
