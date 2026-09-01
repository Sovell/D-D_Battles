import { describe, expect, it } from "vitest";
import { createRandom } from "./random";

describe("seeded random", () => {
  it("repeats a sequence", () => {
    const a = createRandom(123); const b = createRandom(123);
    expect(Array.from({ length: 20 }, () => a.int(1, 20))).toEqual(Array.from({ length: 20 }, () => b.int(1, 20)));
  });
});

