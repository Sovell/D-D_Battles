import { describe, expect, it } from "vitest";
import { getUnitArt, getUnitArtVariantCount } from "./unit-art";

describe("unit art registry", () => {
  it("maps three matching portrait and token variants for every hero", () => {
    for (const id of ["fighter", "rogue", "cleric", "wizard"]) {
      expect(getUnitArtVariantCount(id)).toBe(3);
      expect(getUnitArt(id, 2, "portrait")?.x).toBeGreaterThan(0);
      expect(getUnitArt(id, 2, "token")?.url).toBe(getUnitArt(id, 2, "portrait")?.url);
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
});
