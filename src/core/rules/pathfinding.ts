import type { BattleState, DungeonMap, GridPosition } from "../domain/types";
import { neighbors } from "../map-generation/crypt-generator";

export const positionKey = (position: GridPosition) => `${position.x},${position.y}`;
export const distance = (a: GridPosition, b: GridPosition) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function getReachableCells(state: BattleState, combatantId: string): GridPosition[] {
  const unit = state.combatants.find((candidate) => candidate.id === combatantId);
  if (!unit || unit.hp <= 0 || unit.moved) return [];
  const bonus = unit.statuses.some((status) => status.id === "swift") ? 2 : 0;
  const shape = unit.statuses.some((status) => status.id === "wild-shaped") ? 2 : 0;
  const penalty = unit.statuses.some((status) => status.id === "prone" || status.id === "fatigued") ? 2 : 0;
  const speed = unit.statuses.some((status) => status.id === "webbed") ? 1 : Math.max(1, unit.speed + bonus + shape - penalty);
  const enemies = new Set(state.combatants.filter((candidate) => candidate.hp > 0 && candidate.side !== unit.side).map((candidate) => positionKey(candidate.position)));
  const occupied = new Set(state.combatants.filter((candidate) => candidate.hp > 0 && candidate.id !== unit.id).map((candidate) => positionKey(candidate.position)));
  return reachable(state.map, unit.position, speed, enemies).filter((position) => positionKey(position) !== positionKey(unit.position) && !occupied.has(positionKey(position)));
}

export function findPath(map: DungeonMap, start: GridPosition, goal: GridPosition, blocked = new Set<string>()): GridPosition[] | undefined {
  const queue = [start];
  const previous = new Map<string, GridPosition | undefined>([[positionKey(start), undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (positionKey(current) === positionKey(goal)) return reconstruct(previous, goal);
    for (const next of neighbors(current)) {
      const nextKey = positionKey(next);
      if (!previous.has(nextKey) && !blocked.has(nextKey) && movementCost(map, next) < Infinity) { previous.set(nextKey, current); queue.push(next); }
    }
  }
}

function reachable(map: DungeonMap, start: GridPosition, budget: number, blocked: Set<string>): GridPosition[] {
  const costs = new Map<string, number>([[positionKey(start), 0]]);
  const open = [start];
  while (open.length) {
    const current = open.shift()!;
    const currentCost = costs.get(positionKey(current))!;
    for (const next of neighbors(current)) {
      const cost = currentCost + movementCost(map, next);
      const nextKey = positionKey(next);
      if (cost <= budget && !blocked.has(nextKey) && cost < (costs.get(nextKey) ?? Infinity)) { costs.set(nextKey, cost); open.push(next); }
    }
  }
  return [...costs.keys()].map((value) => { const [x, y] = value.split(",").map(Number); return { x, y }; });
}

function movementCost(map: DungeonMap, position: GridPosition): number {
  const terrain = map.cells.find((cell) => positionKey(cell.position) === positionKey(position))?.terrain;
  if (!terrain || terrain === "wall") return Infinity;
  return terrain === "difficult" || terrain === "rubble" || terrain === "water" ? 2 : 1;
}

function reconstruct(previous: Map<string, GridPosition | undefined>, goal: GridPosition): GridPosition[] {
  const path: GridPosition[] = [];
  let cursor: GridPosition | undefined = goal;
  while (cursor) { path.unshift(cursor); cursor = previous.get(positionKey(cursor)); }
  return path;
}
