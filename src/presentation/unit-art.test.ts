import { describe, expect, it } from "vitest";
import { getUnitArt, getUnitArtVariantCount, getUnitTokenCardArt } from "./unit-art";

describe("unit art registry", () => {
  it("adds portrait-only hero variants while keeping token fallbacks", () => {
    const counts = { fighter: 5, rogue: 4, cleric: 5, wizard: 5 };
    for (const [id, count] of Object.entries(counts)) {
      expect(getUnitArtVariantCount(id)).toBe(count);
      expect(getUnitArt(id, 2, "portrait")?.x).toBeGreaterThan(0);
      expect(getUnitArt(id, 2, "token")?.url).toBe(getUnitArt(id, 2, "portrait")?.url);
      expect(getUnitArt(id, count - 1, "portrait")?.url).not.toBe(getUnitArt(id, count - 1, "token")?.url);
      expect(getUnitArt(id, count - 1, "token")).toEqual(getUnitArt(id, 0, "token"));
    }
  });

  it("clamps variants and exposes renderable sprite coordinates", () => {
    expect(getUnitArt("rogue", 99, "portrait")).toEqual(getUnitArt("rogue", 2, "portrait"));
    expect(getUnitArtVariantCount("ogre")).toBe(1);
    expect(getUnitArt("skeleton", 0, "portrait")).toMatchObject({ sheetWidth: 1402, sheetHeight: 1122, x: 0 });
  });

  it("uses an individual lower focal point for the unusually tall fighter sheet", () => {
    expect(getUnitArt("fighter", 0, "portrait")?.y).toBe(30);
    expect(getUnitArt("rogue", 0, "portrait")?.y).toBe(0);
  });

  it("removes the empty top margin from every monster panel portrait without changing its token", () => {
    for (const id of ["ghoul", "goblin", "skeleton", "ogre", "ritualist", "giant-spider", "owlbear"]) {
      expect(getUnitArt(id, 0, "portrait")?.y).toBeGreaterThan(0);
      expect(getUnitArt(id, 0, "token")?.y).toBe(0);
    }
  });

  it("turns token artwork into a consistent portrait-card crop", () => {
    const fighter = getUnitTokenCardArt("fighter", 0)!;
    const skeleton = getUnitTokenCardArt("skeleton", 0)!;
    expect(fighter.height).toBeLessThan(getUnitArt("fighter", 0, "token")!.height);
    expect(fighter.width / fighter.height).toBeCloseTo(0.9);
    expect(skeleton.width / skeleton.height).toBeCloseTo(0.9);
  });

  it("registers portrait and token frames for the extended roster", () => {
    for (const id of ["orc-brute", "bugbear-ambusher", "zombie", "hobgoblin-captain", "worg", "dire-wolf", "harpy", "minotaur", "troll", "manticore", "wraith", "young-dragon"]) {
      expect(getUnitArtVariantCount(id)).toBe(1);
      expect(getUnitArt(id, 0, "portrait")?.width).toBeGreaterThan(0);
      expect(getUnitArt(id, 0, "token")?.x).toBeGreaterThan(0);
    }
  });
});
