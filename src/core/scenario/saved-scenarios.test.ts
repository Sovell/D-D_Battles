import { describe, expect, it } from "vitest";
import { exampleSavedScenarios, parseSavedScenario, serializeSavedScenario } from "./saved-scenarios";

describe("saved scenario import/export", () => {
  it("round-trips every bundled example as readable schema-versioned JSON", () => {
    const examples = exampleSavedScenarios();
    expect(examples.map((item) => item.name)).toEqual(["Obrona przed Goblin Raid", "Undead Crypt: przerwanie rytuału", "Hard Beast Hunt", "Próba nowych klas"]);
    for (const example of examples) expect(parseSavedScenario(serializeSavedScenario(example))).toEqual({ ok: true, value: example });
  });
  it("rejects old and damaged imports", () => {
    const example = exampleSavedScenarios()[0];
    expect(parseSavedScenario(JSON.stringify({ ...example, schemaVersion: 0 })).ok).toBe(false);
    expect(parseSavedScenario("not-json").ok).toBe(false);
  });
});
