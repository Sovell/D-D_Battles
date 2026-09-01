import { runAiStep } from "../core/ai/action-scoring";
import type { BattleState, Combatant } from "../core/domain/types";
import { createBattle } from "../core/scenario/create-battle";
import { cleanseTheCrypt } from "../core/scenario/scenarios";
import { activeCombatant, attackObjective, endActivation, moveCombatant, useAbility } from "../core/rules/combat";
import { distance, findPath, getReachableCells, positionKey } from "../core/rules/pathfinding";

export interface SimulationReport {
  seed: number;
  outcome: BattleState["outcome"] | "loop";
  rounds: number;
  party: Array<{ id: string; hp: number }>;
  survivingMonsters: string[];
  objectiveHp: number[];
  activeCombatantId?: string;
  lastLog: string[];
  actions: number;
  aiLoopDetected: boolean;
}

export function runHeadlessSimulation(seed: number, maxActions = 1000): SimulationReport {
  let state = createBattle(seed, cleanseTheCrypt);
  let actions = 0;
  let repeated = 0;
  let signature = "";
  while (state.outcome === "active" && actions < maxActions) {
    const before = stateSignature(state);
    state = activeCombatant(state)?.side === "monsters" ? runAiStep(state) : runHeroStep(state);
    const after = stateSignature(state);
    repeated = before === after && after === signature ? repeated + 1 : 0;
    signature = after;
    if (repeated > 10) break;
    actions += 1;
  }
  const aiLoopDetected = state.outcome === "active";
  return {
    seed, outcome: aiLoopDetected ? "loop" : state.outcome, rounds: state.round, actions, aiLoopDetected,
    party: state.combatants.filter((unit) => unit.side === "heroes").map((unit) => ({ id: unit.definitionId, hp: unit.hp })),
    survivingMonsters: state.combatants.filter((unit) => unit.side === "monsters" && unit.hp > 0).map((unit) => unit.definitionId),
    objectiveHp: state.objectives.map((objective) => objective.hp),
    activeCombatantId: activeCombatant(state)?.id,
    lastLog: state.log.slice(-4).map((entry) => entry.text),
  };
}

function runHeroStep(state: BattleState): BattleState {
  const actor = activeCombatant(state)!;
  const enemies = state.combatants.filter((unit) => unit.side === "monsters" && unit.hp > 0);
  const target = nearest(actor, enemies);
  if (!actor.acted && target && distance(actor.position, target.position) <= actor.basicAttack.range) return useAbility(state, actor.id, actor.basicAttack.id, target.id);
  const objective = state.objectives.filter((item) => item.hp > 0).sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0];
  if (!actor.acted && objective && distance(actor.position, objective.position) <= 1) return attackObjective(state, actor.id, objective.id);
  const destination = objective?.position ?? target?.position;
  const cells = getReachableCells(state, actor.id);
  if (!actor.moved && destination && cells.length) {
    const reachable = new Set(cells.map(positionKey));
    const path = findPath(state.map, actor.position, destination) ?? [];
    const next = [...path].reverse().find((cell) => reachable.has(positionKey(cell))) ?? [...cells].sort((a, b) => distance(a, destination) - distance(b, destination))[0];
    return moveCombatant(state, actor.id, next);
  }
  return endActivation(state);
}

function nearest(actor: Combatant, units: Combatant[]): Combatant | undefined { return [...units].sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0]; }
function stateSignature(state: BattleState): string { return JSON.stringify([state.round, state.activeIndex, state.combatants.map((unit) => [unit.id, unit.hp, unit.position, unit.moved, unit.acted]), state.objectives.map((item) => item.hp)]); }
