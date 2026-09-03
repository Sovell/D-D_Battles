import type { BattleState, ScenarioCondition } from "../domain/types";
import { distance } from "../rules/pathfinding";

export function isScenarioConditionMet(state: BattleState, condition: ScenarioCondition): boolean {
  if (condition.type === "all") return condition.conditions.every((item) => isScenarioConditionMet(state, item));
  if (condition.type === "any") return condition.conditions.some((item) => isScenarioConditionMet(state, item));
  if (condition.type === "all-monsters-defeated") return !state.combatants.some((unit) => unit.side === "monsters" && unit.hp > 0);
  if (condition.type === "survive-until-round") return state.round >= condition.round;
  if (condition.type === "round-exceeded") return state.round > condition.round;
  if (condition.type === "unit-defeated") return !state.combatants.some((unit) => unit.definitionId === condition.definitionId && unit.hp > 0);
  if (condition.type === "objectives-destroyed") return state.objectives.length > 0 && state.objectives.every((objective) => objective.hp <= 0);
  const living = state.combatants.filter((unit) => unit.side === condition.side && unit.hp > 0);
  const inside = living.filter((unit) => distance(unit.position, condition.center) <= condition.radius).length;
  return condition.required === "all" ? living.length > 0 && inside === living.length : inside >= condition.required;
}
