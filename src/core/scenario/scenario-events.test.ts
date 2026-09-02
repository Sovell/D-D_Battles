import { describe, expect, it } from "vitest";
import type { ScenarioEventDefinition } from "../domain/types";
import { endActivation, moveCombatant } from "../rules/combat";
import { getReachableCells } from "../rules/pathfinding";
import { createBattle } from "./create-battle";
import { cleanseTheCrypt } from "./scenarios";
import { dismissScenarioEventNotice, resolveScenarioEvents, resolveStateChangeEvents, validateScenarioEvents } from "./scenario-events";

describe("scenario events", () => {
  it("resolves a battle-start event once and queues a dismissible notice", () => {
    const events: ScenarioEventDefinition[] = [{ id: "intro", name: "Intro", trigger: { type: "battle-start" }, effect: { type: "show-message", text: "Wejdźcie do krypty." } }];
    const state = createBattle(81, { ...cleanseTheCrypt, events });
    expect(state.resolvedEventIds).toEqual(["intro"]);
    expect(state.pendingEventNotices).toEqual([{ id: "intro", name: "Intro", text: "Wejdźcie do krypty." }]);
    expect(resolveScenarioEvents(state, [{ type: "battle-start" }]).pendingEventNotices).toHaveLength(1);
    expect(dismissScenarioEventNotice(state).pendingEventNotices).toEqual([]);
  });

  it("supports round, unit, objective and entered-cell triggers", () => {
    const events: ScenarioEventDefinition[] = [
      { id: "round", name: "Runda", trigger: { type: "round-start", round: 2 }, effect: { type: "change-objective", text: "Nowy cel" } },
      { id: "unit", name: "Wróg pokonany", trigger: { type: "unit-defeated", definitionId: "skeleton" }, effect: { type: "show-message", text: "Kości opadły." } },
      { id: "objective", name: "Cel zniszczony", trigger: { type: "objective-destroyed" }, effect: { type: "show-message", text: "Ognisko zgasło." } },
      { id: "cell", name: "Próg", trigger: { type: "unit-entered-cell", side: "heroes", position: { x: 4, y: 5 } }, effect: { type: "show-message", text: "Pułapka!" } },
    ];
    let state = createBattle(82, { ...cleanseTheCrypt, events });
    state = resolveScenarioEvents(state, [{ type: "round-start", round: 2 }]);
    expect(state.objectiveTextOverride).toBe("Nowy cel");
    state = resolveScenarioEvents(state, [
      { type: "unit-defeated", unitId: "x", side: "monsters", definitionId: "skeleton" },
      { type: "objective-destroyed", objectiveId: state.objectives[0].id },
      { type: "unit-entered-cell", unitId: "hero-fighter", side: "heroes", definitionId: "fighter", position: { x: 4, y: 5 } },
    ]);
    expect(state.resolvedEventIds).toEqual(["round", "unit", "objective", "cell"]);
  });

  it("derives defeat and objective signals from state changes", () => {
    const events: ScenarioEventDefinition[] = [
      { id: "unit", name: "Wróg pokonany", trigger: { type: "unit-defeated", side: "monsters" }, effect: { type: "show-message", text: "Wróg pada." } },
      { id: "objective", name: "Cel zniszczony", trigger: { type: "objective-destroyed" }, effect: { type: "show-message", text: "Cel pada." } },
    ];
    const before = createBattle(83, { ...cleanseTheCrypt, events });
    const monsterId = before.combatants.find((unit) => unit.side === "monsters")!.id;
    const objectiveId = before.objectives[0].id;
    const after = {
      ...before,
      combatants: before.combatants.map((unit) => unit.id === monsterId ? { ...unit, hp: 0 } : unit),
      objectives: before.objectives.map((objective) => objective.id === objectiveId ? { ...objective, hp: 0 } : objective),
    };
    expect(resolveStateChangeEvents(before, after).resolvedEventIds).toEqual(["unit", "objective"]);
  });

  it("spawns valid monster reinforcements on free walkable cells", () => {
    const events: ScenarioEventDefinition[] = [{ id: "wave", name: "Posiłki", trigger: { type: "round-start", round: 2 }, effect: { type: "spawn-monsters", monsterIds: ["skeleton", "ghoul"] } }];
    const before = createBattle(84, { ...cleanseTheCrypt, events });
    const after = resolveScenarioEvents(before, [{ type: "round-start", round: 2 }]);
    expect(after.combatants).toHaveLength(before.combatants.length + 2);
    expect(after.initiativeOrder.slice(-2)).toEqual(after.combatants.slice(-2).map((unit) => unit.id));
    expect(new Set(after.combatants.filter((unit) => unit.hp > 0).map((unit) => `${unit.position.x},${unit.position.y}`)).size).toBe(after.combatants.filter((unit) => unit.hp > 0).length);
  });

  it("is wired into movement and round advancement", () => {
    let state = createBattle(85, { ...cleanseTheCrypt, events: [] });
    const actor = state.combatants.find((unit) => unit.id === state.initiativeOrder[state.activeIndex])!;
    const destination = getReachableCells(state, actor.id)[0];
    state = {
      ...state,
      scenario: {
        ...state.scenario,
        events: [
          { id: "step", name: "Próg", trigger: { type: "unit-entered-cell", position: destination }, effect: { type: "show-message", text: "Pole aktywowane." } },
          { id: "round", name: "Druga runda", trigger: { type: "round-start", round: 2 }, effect: { type: "show-message", text: "Nowa runda." } },
        ],
      },
    };
    state = moveCombatant(state, actor.id, destination);
    expect(state.resolvedEventIds).toContain("step");
    state = { ...state, activeIndex: state.initiativeOrder.length - 1 };
    state = endActivation(state);
    expect(state.round).toBe(2);
    expect(state.resolvedEventIds).toContain("round");
  });

  it("validates ids, trigger values and effect data for a future creator", () => {
    expect(validateScenarioEvents([{ id: "ok", name: "Runda", trigger: { type: "round-start", round: 2 }, effect: { type: "spawn-monsters", monsterIds: ["skeleton"] } }])).toBe(true);
    expect(validateScenarioEvents([{ id: "bad", name: "", trigger: { type: "round-start", round: 0 }, effect: { type: "spawn-monsters", monsterIds: ["unknown"] } }])).toBe(false);
  });
});
