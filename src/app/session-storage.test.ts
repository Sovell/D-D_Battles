import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { interruptTheRitual } from "../core/scenario/scenarios";
import { createDefaultScenarioDraft, selectScenarioPreset } from "./scenario-builder-model";
import { parseBattleSession, parseScenarioDraft } from "./session-storage";

describe("session storage", () => {
  it("round-trips a complete battle snapshot", () => {
    const state = { ...createBattle(44, interruptTheRitual), round: 4 };
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: "2026-09-01T10:00:00.000Z", seed: 44, heroIds: ["fighter", "rogue", "cleric"], state });
    expect(parseBattleSession(raw)?.state).toEqual(state);
  });

  it("round-trips the latest scenario draft", () => {
    const draft = selectScenarioPreset(createDefaultScenarioDraft(9182), "interrupt-the-ritual");
    expect(parseScenarioDraft(JSON.stringify(draft))).toEqual(draft);
  });

  it("ignores corrupted and incompatible saves", () => {
    expect(parseBattleSession("not-json")).toBeNull();
    expect(parseBattleSession(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(parseScenarioDraft(JSON.stringify({ presetId: "unknown" }))).toBeNull();
  });
});
