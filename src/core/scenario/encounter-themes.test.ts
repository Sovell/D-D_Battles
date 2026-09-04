import { describe, expect, it } from "vitest";
import { encounterThemeById, generateThemedEncounter, themeSupportsRoster } from "./encounter-themes";

describe("encounter themes", () => {
  it("generates deterministic rosters exclusively from the theme", () => {
    const roster = generateThemedEncounter("goblin-raid", 55, 818);
    expect(generateThemedEncounter("goblin-raid", 55, 818)).toEqual(roster);
    expect(themeSupportsRoster("goblin-raid", roster)).toBe(true);
    expect(roster.every((id) => encounterThemeById.get("goblin-raid")!.allowedMonsterIds.includes(id))).toBe(true);
  });
  it("rejects lore-incoherent rosters", () => expect(themeSupportsRoster("undead-crypt", ["skeleton", "goblin"])).toBe(false));
});
