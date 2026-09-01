import { describe, expect, it } from "vitest";
import { runHeadlessSimulation } from "./headless-simulation";

describe("headless simulation", () => {
  it("terminates and reports required metrics across seeds", () => {
    for (const seed of [10, 20, 30, 40, 50]) {
      const report = runHeadlessSimulation(seed);
      expect(report.aiLoopDetected).toBe(false);
      expect(["victory", "defeat"]).toContain(report.outcome);
      expect(report.party).toHaveLength(4);
      expect(report.actions).toBeLessThan(1000);
    }
  });
});
