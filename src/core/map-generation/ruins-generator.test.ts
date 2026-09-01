import { describe, expect, it } from "vitest";
import { validateDungeonMap } from "./crypt-generator";
import { generateRuins } from "./ruins-generator";

describe("ruins generator", () => {
  it("is deterministic and connected", () => {
    expect(generateRuins(812)).toEqual(generateRuins(812));
    for (let seed = 1; seed <= 20; seed += 1) expect(validateDungeonMap(generateRuins(seed)).valid).toBe(true);
  });
  it("adds ruined terrain without necromantic foci", () => {
    const map = generateRuins(91);
    expect(map.theme).toBe("ruins");
    expect(map.objectives).toEqual([]);
    expect(map.cells.some((cell) => ["rubble", "highGround", "hazard"].includes(cell.terrain))).toBe(true);
  });
  it("changes room topology and floor geometry between seeds", () => {
    const maps = Array.from({ length: 12 }, (_, index) => generateRuins(index + 1));
    const roomCounts = new Set(maps.map((map) => map.rooms.length));
    const floorShapes = new Set(maps.map((map) => map.cells.filter((cell) => cell.terrain !== "wall").map((cell) => `${cell.position.x},${cell.position.y}`).join("|")));
    expect(roomCounts.size).toBeGreaterThan(1);
    expect(floorShapes.size).toBeGreaterThan(3);
  });
});
