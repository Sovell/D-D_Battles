import type { ActionTarget, GridPosition } from "../domain/types";

export type ScenarioAiPlan = "defendObjective" | "delayHeroes" | "breakThrough" | "protectTarget" | "interceptCarrier" | "escape" | "eliminateParty";
export type AiIntent = "engage" | "hold" | "flank" | "screen" | "retreat" | "useControl" | "useRangedAttack" | "pursueObjective";

export type AiAction =
  | { kind: "attack"; abilityId: string; target: ActionTarget }
  | { kind: "move"; position: GridPosition }
  | { kind: "end" };

export interface AiCandidate {
  action: AiAction;
  intent: AiIntent;
  score: number;
  reasons: string[];
  tieBreaker: number;
}
