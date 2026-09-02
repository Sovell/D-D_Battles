import { describe, expect, it } from "vitest";
import { calculateBoardCellSize, clampZoom, zoomCameraAtPoint } from "./board-camera";

describe("board camera", () => {
  it("clamps zoom to the supported range", () => {
    expect(clampZoom(0.1)).toBe(0.75);
    expect(clampZoom(4)).toBe(2.5);
  });

  it("keeps the world point under the cursor while zooming", () => {
    const viewport = { width: 800, height: 600 };
    const world = { width: 600, height: 400 };
    const pointer = { x: 250, y: 180 };
    const next = zoomCameraAtPoint({ zoom: 1, panX: 0, panY: 0 }, 1.5, pointer, viewport, world);
    expect(next).toEqual({ zoom: 1.5, panX: 75, panY: 60 });
  });

  it("starts with roomier cells while keeping their size bounded", () => {
    expect(calculateBoardCellSize({ width: 690, height: 490 }, { width: 18, height: 12 })).toBe(47);
    expect(calculateBoardCellSize({ width: 320, height: 240 }, { width: 24, height: 18 })).toBe(36);
    expect(calculateBoardCellSize({ width: 1600, height: 1000 }, { width: 10, height: 8 })).toBe(64);
  });
});
