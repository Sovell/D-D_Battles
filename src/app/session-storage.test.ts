import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { interruptTheRitual } from "../core/scenario/scenarios";
import { createHeroProfile } from "../core/progression/hero-progression";
import { createDefaultScenarioDraft, selectScenarioPreset } from "./scenario-builder-model";
import { parseBattleSaveList, parseBattleSession, parseHeroProfileCollection, parseScenarioDraft } from "./session-storage";

describe("session storage", () => {
  it("round-trips a complete battle snapshot", () => {
    const state = { ...createBattle(44, interruptTheRitual), round: 4 };
    const raw = JSON.stringify({ schemaVersion: 2, savedAt: "2026-09-01T10:00:00.000Z", seed: 44, heroSnapshots: state.heroSnapshots, state });
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
    const { heroProfileIds: _profiles, mapEnvironment: _environment, map: _map, events: _events, ...rest } = draft;
    const legacy = { ...rest, heroIds: ["fighter", "rogue", "cleric", "wizard"], heroVariants: { fighter: 2 } };
    const migrated = parseScenarioDraft(JSON.stringify(legacy));
    expect(migrated?.heroProfileIds).toEqual(["fighter", "rogue", "cleric", "wizard"]);
    expect(migrated?.map.cells).toHaveLength(migrated!.map.width * migrated!.map.height);
    expect(migrated?.events.length).toBeGreaterThan(0);
  });

  it("keeps selected hero art in the saved battle state", () => {
    const state = createBattle(56, interruptTheRitual, ["fighter", "rogue", "cleric"], { fighter: 2, rogue: 1, cleric: 0 });
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: "2026-09-01T10:00:00.000Z", seed: 56, heroIds: ["fighter", "rogue", "cleric"], state });
    const restored = parseBattleSession(raw)?.state;
    expect(restored?.combatants.find((unit) => unit.definitionId === "fighter")?.artVariant).toBe(2);
    expect(restored?.combatants.find((unit) => unit.definitionId === "rogue")?.artVariant).toBe(1);
    expect(parseBattleSession(raw)?.heroSnapshots.find((profile) => profile.classId === "fighter")?.portraitVariant).toBe(2);
  });

  it("migrates v1 battle saves to immutable hero snapshots", () => {
    const state = createBattle(57, interruptTheRitual, ["fighter", "rogue", "cleric"]);
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: "2026-09-01T10:00:00.000Z", seed: 57, heroIds: ["fighter", "rogue", "cleric"], state: { ...state, heroSnapshots: undefined, progressionRewardClaimed: undefined } });
    const migrated = parseBattleSession(raw);
    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.heroSnapshots.map((profile) => profile.id)).toEqual(["fighter", "rogue", "cleric"]);
    expect(migrated?.state.heroSnapshots).toEqual(migrated?.heroSnapshots);
  });

  it("round-trips v1 profile storage and migrates legacy campaign entries", () => {
    const profile = createHeroProfile({ id: "tordek", name: "Tordek", race: "dwarf", classId: "fighter", portraitVariant: 4 });
    expect(parseHeroProfileCollection(JSON.stringify({ schemaVersion: 1, profiles: [profile] }))?.profiles).toEqual([profile]);
    const legacy = parseHeroProfileCollection(JSON.stringify([{ heroClassId: "wizard", level: 4 }]));
    expect(legacy?.profiles[0]).toMatchObject({ id: "wizard-1", classId: "wizard", race: "human", level: 1, xp: 0 });
  });

  it("rejects damaged profile data and derives level safely from XP", () => {
    const profile = createHeroProfile({ id: "mialee", name: "Mialee", race: "elf", classId: "wizard" });
    const normalized = parseHeroProfileCollection(JSON.stringify({ schemaVersion: 1, profiles: [{ ...profile, level: 5, xp: 100 }] }));
    expect(normalized?.profiles[0].level).toBe(2);
    expect(parseHeroProfileCollection(JSON.stringify({ schemaVersion: 1, profiles: [{ ...profile, race: "unknown" }] }))).toBeNull();
    expect(parseHeroProfileCollection(JSON.stringify({ schemaVersion: 99, profiles: [profile] }))).toBeNull();
  });

  it("ignores corrupted and incompatible saves", () => {
    expect(parseBattleSession("not-json")).toBeNull();
    expect(parseBattleSession(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(parseScenarioDraft(JSON.stringify({ presetId: "unknown" }))).toBeNull();
  });

  it("loads valid named saves and skips damaged entries", () => {
    const state = createBattle(72, interruptTheRitual);
    const valid = { schemaVersion: 1, id: "save-1", name: "Rytuał · runda 1", savedAt: "2026-09-01T10:00:00.000Z", seed: 72, heroIds: ["fighter", "rogue", "cleric"], state };
    const parsed = parseBattleSaveList(JSON.stringify([valid, { id: "broken" }]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ schemaVersion: 2, id: "save-1", name: "Rytuał · runda 1" });
  });
});
