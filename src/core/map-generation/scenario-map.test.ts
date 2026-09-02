import { describe, expect, it } from "vitest";
import { validateDungeonMap } from "./crypt-generator";
import { generateScenarioMap, type MapEnvironment } from "./scenario-map";

describe("scenario map generator", () => {
  const environments: MapEnvironment[] = ["dungeon", "outdoor", "interior"];

  it.each(environments)("creates a valid %s map", (environment) => {
    expect(validateDungeonMap(generateScenarioMap(741, environment, true))).toEqual({ valid: true, errors: [] });
  });

  it.each(environments)("is deterministic for %s", (environment) => {
    expect(generateScenarioMap(812, environment, true)).toEqual(generateScenarioMap(812, environment, true));
  });

  it("can generate maps without scenario objectives", () => {
    for (const environment of environments) {
      const map = generateScenarioMap(321, environment, false);
      expect(map.objectives).toEqual([]);
      expect(map.cells.every((cell) => cell.objectiveId === undefined)).toBe(true);
    }
  });
});
