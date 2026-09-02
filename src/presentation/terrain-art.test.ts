import { describe, expect, it } from "vitest";
import { getTerrainArt } from "./terrain-art";

describe("terrain art registry", () => {
  it("maps every terrain currently generated for the crypt", () => {
    for (const terrain of ["floor", "rubble", "cover"] as const) {
      expect(getTerrainArt("crypt", terrain)?.url).toMatch(/\.png$/);
    }
    expect(getTerrainArt("crypt", "wall")).toBeUndefined();
  });

  it("maps every terrain currently generated for the ruins", () => {
    for (const terrain of ["floor", "rubble", "highGround", "hazard"] as const) {
      expect(getTerrainArt("ruins", terrain)?.url).toMatch(/\.png$/);
    }
    expect(getTerrainArt("ruins", "wall")).toBeUndefined();
  });

  it("keeps unused scenery on the color fallback", () => {
    expect(getTerrainArt("crypt", "water")).toBeUndefined();
    expect(getTerrainArt("cave", "floor")).toBeUndefined();
  });
});
