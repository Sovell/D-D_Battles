import { describe, expect, it } from "vitest";
import type { BattleState, GridPosition, ScenarioTemplateId } from "../domain/types";
import { generateScenarioMap } from "../map-generation/scenario-map";
import { createLegacyRoster } from "../progression/hero-progression";
import { createBattle } from "../scenario/create-battle";
import { buildScenarioTemplate, scenarioTemplateById } from "../scenario/scenario-templates";
import { distance } from "../rules/pathfinding";
import { chooseAiCandidate, evaluateAiCandidates, getScenarioAiPlan, runAiStep, seededTieBreaker } from "./action-scoring";

describe("tactical AI", () => {
  it("keeps a guardian inside the defensive radius of an objective", () => {
    let state = makeState("skeleton", "rescue", ["skeleton", "zombie"]);
    const actor = active(state);
    const objective = state.objectives[0].position;
    state = place(state, actor.id, { x: objective.x - 1, y: objective.y });
    const decision = chooseAiCandidate(state)!;
    if (decision.action.kind === "move") expect(distance(decision.action.position, objective)).toBeLessThanOrEqual(2);
    else expect(decision.action.kind).toBe("end");
  });

  it("makes a ranged unit disengage instead of voluntarily remaining in melee", () => {
    let state = makeState("manticore", "skirmish", ["manticore"]);
    const actor = active(state);
    const fighter = unit(state, "fighter");
    state = place(place(state, actor.id, { x: 5, y: 5 }), fighter.id, { x: 6, y: 5 });
    const decision = chooseAiCandidate(state)!;
    expect(decision.action.kind).toBe("move");
    if (decision.action.kind === "move") expect(distance(decision.action.position, fighter.position)).toBeGreaterThan(1);
    expect(decision.intent).toBe("retreat");
  });

  it("moves a skirmisher into a true flank", () => {
    let state = makeState("bugbear-ambusher", "skirmish", ["bugbear-ambusher", "goblin"]);
    const actor = active(state);
    const fighter = unit(state, "fighter");
    const ally = unit(state, "goblin");
    state = place(place(place(state, actor.id, { x: 3, y: 5 }), fighter.id, { x: 5, y: 5 }), ally.id, { x: 6, y: 5 });
    const decision = chooseAiCandidate(state)!;
    expect(decision).toMatchObject({ intent: "flank", action: { kind: "move", position: { x: 4, y: 5 } } });
  });

  it("does not let the ritualist leave the ritual zone", () => {
    let state = makeState("ritualist", "ritual-disruption", ["ritualist", "skeleton"]);
    const actor = active(state);
    const ritualZone = state.map.monsterStart[0];
    state = place(state, actor.id, ritualZone);
    const decision = chooseAiCandidate(state)!;
    if (decision.action.kind === "move") expect(distance(decision.action.position, ritualZone)).toBeLessThanOrEqual(1);
    expect(decision.reasons.some((reason) => reason.includes("rytuału") || reason.includes("pozycji"))).toBe(true);
  });

  it("lets the Hold the Line plan make attackers cross the line instead of taking an available attack", () => {
    let state = makeState("orc-brute", "hold-the-line", ["orc-brute"]);
    const actor = active(state);
    const fighter = unit(state, "fighter");
    const goal = { x: 1, y: 5 };
    state = { ...place(place(state, actor.id, { x: 5, y: 5 }), fighter.id, { x: 6, y: 5 }), map: { ...state.map, heroStart: [goal, ...state.map.heroStart.slice(1)] } };
    const decision = chooseAiCandidate(state)!;
    expect(getScenarioAiPlan(state)).toBe("breakThrough");
    expect(decision).toMatchObject({ intent: "pursueObjective", action: { kind: "move" } });
    if (decision.action.kind === "move") expect(distance(decision.action.position, goal)).toBeLessThan(distance(actor.position, goal));
  });

  it("makes Breakthrough defenders screen the clearly marked hero exit", () => {
    const state = makeState("skeleton", "breakthrough", ["skeleton"]);
    expect(getScenarioAiPlan(state)).toBe("delayHeroes");
    expect(chooseAiCandidate(state)?.action.kind).not.toBe("end");
  });

  it("always advances or consumes part of a monster activation", () => {
    for (const templateId of ["skirmish", "breakthrough"] as const) {
      let state = makeState("skeleton", templateId, ["skeleton", "zombie"]);
      const actorId = active(state).id;
      for (let step = 0; step < 3 && active(state).id === actorId; step += 1) {
        const before = active(state);
        const next = runAiStep(state);
        const after = next.combatants.find((unit) => unit.id === actorId)!;
        expect(next !== state || after.moved !== before.moved || after.acted !== before.acted).toBe(true);
        state = next;
      }
      expect(active(state).id).not.toBe(actorId);
    }
  });

  it("scores basic attacks, abilities, movement and holding in one deterministic list", () => {
    let state = makeState("young-dragon", "skirmish", ["young-dragon"]);
    state = place(place(state, active(state).id, { x: 5, y: 5 }), unit(state, "fighter").id, { x: 6, y: 5 });
    const kinds = new Set(evaluateAiCandidates(state).map((candidate) => candidate.action.kind === "attack" ? candidate.action.abilityId === active(state).basicAttack.id ? "basic" : "ability" : candidate.action.kind));
    expect(kinds).toEqual(new Set(["basic", "ability", "move", "end"]));
  });

  it("uses seeded variation only as a stable tie breaker", () => {
    expect(seededTieBreaker(42, 3, "goblin-1", "left")).toBe(seededTieBreaker(42, 3, "goblin-1", "left"));
    expect(new Set([40, 41, 42, 43].map((seed) => seededTieBreaker(seed, 3, "goblin-1", "left"))).size).toBeGreaterThan(1);
  });

  it("maps every scenario template to an explicit plan", () => {
    const plans = (["skirmish", "hold-the-line", "breakthrough", "assassinate", "rescue", "ritual-disruption", "escape", "treasure-run"] as ScenarioTemplateId[]).map((id) => getScenarioAiPlan(makeState(scenarioTemplateById.get(id)!.monsters[0], id)));
    expect(plans).toEqual(["eliminateParty", "breakThrough", "delayHeroes", "protectTarget", "defendObjective", "protectTarget", "escape", "interceptCarrier"]);
  });
});

function makeState(activeDefinitionId: string, templateId: ScenarioTemplateId, monsters = [activeDefinitionId]): BattleState {
  const template = scenarioTemplateById.get(templateId)!;
  const map = generateScenarioMap(7301, template.environment, template.requiresObjectives);
  const scenario = buildScenarioTemplate(templateId, map);
  const state = createBattle(7301, { ...scenario, encounter: { ...scenario.encounter, monsters } }, createLegacyRoster().slice(0, 3));
  const actor = state.combatants.find((candidate) => candidate.definitionId === activeDefinitionId)!;
  const positions: GridPosition[] = [{ x: 2, y: 2 }, { x: 2, y: 4 }, { x: 2, y: 6 }, { x: 12, y: 2 }, { x: 12, y: 4 }, { x: 12, y: 6 }];
  return {
    ...state,
    activeIndex: state.initiativeOrder.indexOf(actor.id),
    map: { ...state.map, cells: state.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) },
    combatants: state.combatants.map((candidate, index) => ({ ...candidate, position: positions[index], acted: false, moved: false })),
  };
}

function active(state: BattleState) { return state.combatants.find((candidate) => candidate.id === state.initiativeOrder[state.activeIndex])!; }
function unit(state: BattleState, definitionId: string) { return state.combatants.find((candidate) => candidate.definitionId === definitionId)!; }
function place(state: BattleState, id: string, position: GridPosition): BattleState { return { ...state, combatants: state.combatants.map((candidate) => candidate.id === id ? { ...candidate, position } : candidate) }; }
