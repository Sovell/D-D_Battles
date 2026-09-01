import type { DungeonMap, GridPosition, TerrainType } from "../domain/types";
import { positionKey } from "./pathfinding";

export function hasLineOfSight(map: DungeonMap, from: GridPosition, to: GridPosition): boolean {
  const points = rasterLine(from, to);
  return points.slice(1, -1).every((position) => terrainAt(map, position) !== "wall");
}

export function terrainAt(map: DungeonMap, position: GridPosition): TerrainType | undefined {
  return map.cells.find((cell) => positionKey(cell.position) === positionKey(position))?.terrain;
}

function rasterLine(from: GridPosition, to: GridPosition): GridPosition[] {
  const points: GridPosition[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;
  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) return points;
    const doubled = error * 2;
    if (doubled > -dy) { error -= dy; x += stepX; }
    if (doubled < dx) { error += dx; y += stepY; }
  }
}
