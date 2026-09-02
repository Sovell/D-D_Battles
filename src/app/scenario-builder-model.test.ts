import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { buildScenarioFromDraft, createDefaultScenarioDraft, editScenarioMapCell, regenerateScenarioMap, selectScenarioPreset, setHeroVariant, setMonsterCount, validateScenarioDraft } from "./scenario-builder-model";

describe("scenario builder", () => {
  it("creates a valid default expedition", () => expect(validateScenarioDraft(createDefaultScenarioDraft())).toEqual([]));
  it("requires a party of three or four unique heroes", () => {
    expect(validateScenarioDraft({ ...createDefaultScenarioDraft(), heroIds: ["fighter", "rogue"] })).toContain("Drużyna musi mieć 3–4 bohaterów.");
    expect(validateScenarioDraft({ ...createDefaultScenarioDraft(), heroIds: ["fighter", "fighter", "rogue"] })).toContain("Nie można wybrać tej samej klasy dwa razy.");
  });
  it("allows encounters larger than five and allocates unique legal cells", () => {
    const draft = setMonsterCount({ ...createDefaultScenarioDraft(), monsterIds: [] }, "ogre", 8);
    const scenario = buildScenarioFromDraft(draft);
    const battle = createBattle(draft.seed, scenario, draft.heroIds, draft.heroVariants);
    const enemies = battle.combatants.filter((unit) => unit.side === "monsters");
    expect(scenario.encounter.monsters).toEqual(Array(8).fill("ogre"));
    expect(new Set(enemies.map((unit) => `${unit.position.x},${unit.position.y}`)).size).toBe(8);
  });
  it("stores a bounded portrait variant for each hero", () => {
    const draft = setHeroVariant(createDefaultScenarioDraft(), "rogue", 2);
    expect(draft.heroVariants.rogue).toBe(2);
    expect(setHeroVariant(draft, "rogue", 9).heroVariants.rogue).toBe(2);
    expect(validateScenarioDraft(draft)).toEqual([]);
  });
  it("builds a ritual scenario with a mandatory ritualist and round limit", () => {
    const draft = selectScenarioPreset(createDefaultScenarioDraft(808), "interrupt-the-ritual");
    const scenario = buildScenarioFromDraft(draft);
    expect(scenario.theme).toBe("ruins");
    expect(scenario.victoryCondition).toBe("defeat-ritualist");
    expect(scenario.roundLimit).toBe(8);
    expect(scenario.encounter.monsters).toContain("ritualist");
  });
  it("keeps a manually edited map and events in the launched scenario", () => {
    let draft = createDefaultScenarioDraft(909);
    draft = editScenarioMapCell(draft, { x: 0, y: 0 }, "highGround");
    draft = { ...draft, events: [{ id: "arrival", name: "Przybycie", trigger: { type: "round-start", round: 3 }, effect: { type: "show-message", text: "Nadchodzą." } }] };
    const scenario = buildScenarioFromDraft(draft);
    expect(scenario.map?.cells.find((cell) => cell.position.x === 0 && cell.position.y === 0)?.terrain).toBe("highGround");
    expect(scenario.events).toEqual(draft.events);
  });
  it("regenerates the selected environment without changing the roster", () => {
    const draft = setMonsterCount(createDefaultScenarioDraft(912), "skeleton", 7);
    const regenerated = regenerateScenarioMap(draft, "interior");
    expect(regenerated.mapEnvironment).toBe("interior");
    expect(regenerated.map.id).toBe("interior-912");
    expect(regenerated.monsterIds).toEqual(draft.monsterIds);
  });
});
