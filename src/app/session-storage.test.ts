import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { interruptTheRitual } from "../core/scenario/scenarios";
import { createDefaultScenarioDraft, selectScenarioPreset } from "./scenario-builder-model";
import { parseBattleSaveList, parseBattleSession, parseScenarioDraft } from "./session-storage";

describe("session storage", () => {
  it("round-trips a complete battle snapshot", () => {
    const state = { ...createBattle(44, interruptTheRitual), round: 4 };
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: "2026-09-01T10:00:00.000Z", seed: 44, heroIds: ["fighter", "rogue", "cleric"], state });
    expect(parseBattleSession(raw)?.state).toEqual(state);
    expect(parseBattleSession(raw)?.state.resolvedEventIds).toContain("ritual-begins");
    expect(parseBattleSession(raw)?.state.pendingEventNotices?.[0]?.name).toBe("Rytuał przy pękniętej pieczęci");
  });

  it("round-trips the latest scenario draft", () => {
    const draft = selectScenarioPreset(createDefaultScenarioDraft(9182), "interrupt-the-ritual");
    expect(parseScenarioDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it("migrates an older scenario draft to portraits, map and events", () => {
    const draft = createDefaultScenarioDraft(55);
    const { heroVariants: _variants, mapEnvironment: _environment, map: _map, events: _events, ...legacy } = draft;
    const migrated = parseScenarioDraft(JSON.stringify(legacy));
    expect(migrated?.heroVariants).toEqual({ fighter: 0, rogue: 0, cleric: 0, wizard: 0 });
    expect(migrated?.map.cells).toHaveLength(migrated!.map.width * migrated!.map.height);
    expect(migrated?.events.length).toBeGreaterThan(0);
  });

  it("keeps selected hero art in the saved battle state", () => {
    const state = createBattle(56, interruptTheRitual, ["fighter", "rogue", "cleric"], { fighter: 2, rogue: 1, cleric: 0 });
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: "2026-09-01T10:00:00.000Z", seed: 56, heroIds: ["fighter", "rogue", "cleric"], state });
    const restored = parseBattleSession(raw)?.state;
    expect(restored?.combatants.find((unit) => unit.definitionId === "fighter")?.artVariant).toBe(2);
    expect(restored?.combatants.find((unit) => unit.definitionId === "rogue")?.artVariant).toBe(1);
  });

  it("ignores corrupted and incompatible saves", () => {
    expect(parseBattleSession("not-json")).toBeNull();
    expect(parseBattleSession(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(parseScenarioDraft(JSON.stringify({ presetId: "unknown" }))).toBeNull();
  });

  it("loads valid named saves and skips damaged entries", () => {
    const state = createBattle(72, interruptTheRitual);
    const valid = { schemaVersion: 1, id: "save-1", name: "Rytuał · runda 1", savedAt: "2026-09-01T10:00:00.000Z", seed: 72, heroIds: ["fighter", "rogue", "cleric"], state };
    expect(parseBattleSaveList(JSON.stringify([valid, { id: "broken" }]))).toEqual([valid]);
  });
});
