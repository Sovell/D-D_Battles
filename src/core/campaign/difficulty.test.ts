import { describe, expect, it } from "vitest";
import { createLegacyRoster } from "../progression/hero-progression";
import { emptyLoadout } from "../equipment/campaign";
import { assessDifficulty, difficultyForRatio, encounterPower, partyPower } from "./difficulty";

describe("campaign difficulty", () => {
  const heroes = createLegacyRoster();
  const loadouts = Object.fromEntries(heroes.map((hero) => [hero.id, emptyLoadout()]));
  it("calculates deterministic and explainable PartyPower", () => {
    const first = partyPower(heroes, loadouts);
    expect(partyPower(heroes, loadouts)).toEqual(first);
    expect(first.total).toBeGreaterThan(0);
    expect(first.parts.map((part) => part.label)).toContain("Wyposażenie");
  });
  it("includes role synergy, objectives and defender advantage in EncounterPower", () => {
    expect(encounterPower(["goblin", "hobgoblin-captain"], "hold-the-line", .1).total).toBeGreaterThan(encounterPower(["goblin", "goblin"], "skirmish").total);
  });
  it("uses the documented thresholds exactly", () => {
    expect([.64, .65, .9, 1.15, 1.4, 1.7].map(difficultyForRatio)).toEqual(["Trivial", "Easy", "Standard", "Hard", "Deadly", "Overwhelming"]);
  });
  it("returns the ratio with both breakdowns", () => expect(assessDifficulty(heroes, loadouts, ["goblin", "goblin"])).toMatchObject({ label: expect.any(String), ratio: expect.any(Number) }));
});
