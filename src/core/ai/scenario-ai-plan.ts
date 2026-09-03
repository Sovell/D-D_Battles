import type { BattleState, GridPosition, ScenarioCondition } from "../domain/types";
import type { ScenarioAiPlan } from "./ai-types";

const templatePlans: Record<string, ScenarioAiPlan> = {
  "skirmish": "eliminateParty",
  "hold-the-line": "breakThrough",
  "breakthrough": "delayHeroes",
  "assassinate": "protectTarget",
  "rescue": "defendObjective",
  "ritual-disruption": "protectTarget",
  "escape": "escape",
  "treasure-run": "interceptCarrier",
};

export function getScenarioAiPlan(state: BattleState): ScenarioAiPlan {
  if (state.scenario.templateId) return templatePlans[state.scenario.templateId] ?? "eliminateParty";
  if (state.scenario.victoryCondition === "defeat-ritualist") return "protectTarget";
  if (state.scenario.victoryCondition === "destroy-foci-and-undead") return "defendObjective";
  if (state.scenario.victoryCondition === "escape-with-artifact") return "interceptCarrier";
  return templatePlans[state.scenario.id] ?? "eliminateParty";
}

export function scenarioGoal(state: BattleState, plan = getScenarioAiPlan(state)): GridPosition | undefined {
  if (plan === "breakThrough") return state.map.heroStart[0];
  if (plan === "delayHeroes") return extractionZone(state.scenario.victoryRules);
  if (plan === "escape") return state.map.monsterStart[0];
  if (plan === "defendObjective" || plan === "interceptCarrier") return state.objectives.find((objective) => objective.hp > 0)?.position ?? extractionZone(state.scenario.victoryRules);
  return extractionZone(state.scenario.victoryRules);
}

function extractionZone(condition?: ScenarioCondition): GridPosition | undefined {
  if (!condition) return undefined;
  if (condition.type === "side-in-zone") return condition.center;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.map(extractionZone).find(Boolean);
}
