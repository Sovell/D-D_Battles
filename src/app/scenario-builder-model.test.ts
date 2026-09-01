import { describe, expect, it } from "vitest";
import { buildScenarioFromDraft, createDefaultScenarioDraft, selectScenarioPreset, setMonsterCount, validateScenarioDraft } from "./scenario-builder-model";

describe("scenario builder", () => {
  it("creates a valid default expedition", () => expect(validateScenarioDraft(createDefaultScenarioDraft())).toEqual([]));
  it("requires a party of three or four unique heroes", () => {
    expect(validateScenarioDraft({ ...createDefaultScenarioDraft(), heroIds: ["fighter", "rogue"] })).toContain("Drużyna musi mieć 3–4 bohaterów.");
    expect(validateScenarioDraft({ ...createDefaultScenarioDraft(), heroIds: ["fighter", "fighter", "rogue"] })).toContain("Nie można wybrać tej samej klasy dwa razy.");
  });
  it("caps a custom encounter at five monsters", () => {
    const draft = setMonsterCount({ ...createDefaultScenarioDraft(), monsterIds: [] }, "ogre", 8);
    expect(draft.monsterIds).toHaveLength(5);
    expect(buildScenarioFromDraft(draft).encounter.monsters).toEqual(Array(5).fill("ogre"));
  });
  it("builds a ritual scenario with a mandatory ritualist and round limit", () => {
    const draft = selectScenarioPreset(createDefaultScenarioDraft(808), "interrupt-the-ritual");
    const scenario = buildScenarioFromDraft(draft);
    expect(scenario.theme).toBe("ruins");
    expect(scenario.victoryCondition).toBe("defeat-ritualist");
    expect(scenario.roundLimit).toBe(8);
    expect(scenario.encounter.monsters).toContain("ritualist");
  });
});
