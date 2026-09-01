import { describe, expect, it } from "vitest";
import { generateCrypt, validateDungeonMap } from "./crypt-generator";

describe("crypt generator", () => {
  it("is deterministic for a seed", () => expect(generateCrypt(42)).toEqual(generateCrypt(42)));
  it("creates connected starts and objectives across many seeds", () => {
    for (let seed = 1; seed <= 50; seed += 1) expect(validateDungeonMap(generateCrypt(seed))).toEqual({ valid: true, errors: [] });
  });
  it("keeps start zones disjoint and objectives on passable cells", () => {
    const map = generateCrypt(77);
    const starts = [...map.heroStart, ...map.monsterStart].map((position) => `${position.x},${position.y}`);
    expect(new Set(starts).size).toBe(starts.length);
    expect(map.objectives.every((objective) => map.cells.some((cell) => cell.position.x === objective.position.x && cell.position.y === objective.position.y && cell.terrain !== "wall"))).toBe(true);
  });
  it("changes room topology and floor geometry between seeds", () => {
    const maps = Array.from({ length: 12 }, (_, index) => generateCrypt(index + 1));
    const roomCounts = new Set(maps.map((map) => map.rooms.length));
    const floorShapes = new Set(maps.map((map) => map.cells.filter((cell) => cell.terrain !== "wall").map((cell) => `${cell.position.x},${cell.position.y}`).join("|")));
    expect(roomCounts.size).toBeGreaterThan(1);
    expect(floorShapes.size).toBeGreaterThan(3);
  });
});
