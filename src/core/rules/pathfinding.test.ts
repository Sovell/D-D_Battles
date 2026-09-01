import { describe, expect, it } from "vitest";
import { generateCrypt } from "../map-generation/crypt-generator";
import { findPath } from "./pathfinding";

describe("pathfinding", () => {
  it("finds a path from party to every objective", () => {
    const map = generateCrypt(111);
    for (const objective of map.objectives) expect(findPath(map, map.heroStart[0], objective.position)?.length).toBeGreaterThan(1);
  });
});

