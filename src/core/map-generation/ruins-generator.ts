import type { DungeonMap, DungeonRoom, GridPosition, MapCell, TerrainType } from "../domain/types";
import { createRandom, type RandomSource } from "../random/random";
import { validateDungeonMap } from "./crypt-generator";

const WIDTH = 18;
const HEIGHT = 12;
const key = ({ x, y }: GridPosition) => `${x},${y}`;

interface RuinsLayout {
  rooms: DungeonRoom[];
  connections: Array<[number, number]>;
}

export function generateRuins(seed: number): DungeonMap {
  const random = createRandom(seed ^ 0x5f3759df);
  const layout = createLayout(random);
  const floors = new Set<string>();
  for (const room of layout.rooms) carveRoom(floors, room);
  for (const [from, to] of layout.connections) carveCorridor(floors, center(layout.rooms[from]), center(layout.rooms[to]), random.next() < 0.5);

  const heroStart = interiorCells(layout.rooms[0]).slice(0, 4);
  const monsterStart = interiorCells(layout.rooms.at(-1)!).slice(-5);
  const protectedCells = new Set([...heroStart, ...monsterStart].map(key));
  const cells: MapCell[] = [];
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const position = { x, y };
    let terrain: TerrainType = floors.has(key(position)) ? "floor" : "wall";
    if (terrain === "floor" && !protectedCells.has(key(position))) {
      const roll = random.next();
      if (roll < 0.08) terrain = "rubble";
      else if (roll < 0.12) terrain = "highGround";
      else if (roll < 0.15) terrain = "hazard";
    }
    cells.push({ position, terrain });
  }

  const map: DungeonMap = {
    id: `ruins-${seed}`,
    seed,
    theme: "ruins",
    width: WIDTH,
    height: HEIGHT,
    cells,
    rooms: layout.rooms,
    heroStart,
    monsterStart,
    objectives: [],
  };
  const validation = validateDungeonMap(map);
  if (!validation.valid) throw new Error(`Generated ruins are invalid: ${validation.errors.join(", ")}`);
  return map;
}

function createLayout(random: RandomSource): RuinsLayout {
  const variant = random.int(0, 2);
  if (variant === 0) {
    const upperFirst = random.next() < 0.5;
    return {
      rooms: [
        room("entry", 1, upperFirst ? 1 : 6, 5, 5),
        room("broken-hall", 7, upperFirst ? 6 : 1, 4, 5),
        room("collapsed-chapel", 8, upperFirst ? 1 : 7, 4, 4),
        room("ritual-sanctum", 13, upperFirst ? 5 : 2, 4, 6),
      ],
      connections: [[0, 1], [0, 2], [1, 3], [2, 3]],
    };
  }
  if (variant === 1) {
    const descending = random.next() < 0.5;
    return {
      rooms: [
        room("entry", 1, descending ? 1 : 7, 5, 4),
        room("fallen-gallery", 5, descending ? 6 : 2, 4, 5),
        room("watch-room", 10, descending ? 1 : 7, 4, 4),
        room("ritual-sanctum", 13, descending ? 6 : 1, 4, 5),
      ],
      connections: [[0, 1], [1, 2], [2, 3]],
    };
  }
  const entryHigh = random.next() < 0.5;
  return {
    rooms: [
      room("entry", 1, entryHigh ? 2 : 6, 4, 5),
      room("north-vault", 6, 1, 4, 4),
      room("south-vault", 6, 7, 4, 4),
      room("shattered-crossing", 10, 4, 4, 4),
      room("ritual-sanctum", 13, entryHigh ? 6 : 1, 4, 5),
    ],
    connections: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
  };
}

function room(id: string, x: number, y: number, width: number, height: number): DungeonRoom {
  return { id, x, y, width, height };
}

function carveRoom(cells: Set<string>, target: DungeonRoom): void {
  for (let y = target.y; y < target.y + target.height; y += 1) for (let x = target.x; x < target.x + target.width; x += 1) cells.add(key({ x, y }));
}

function carveCorridor(cells: Set<string>, from: GridPosition, to: GridPosition, horizontalFirst: boolean): void {
  let { x, y } = from;
  const horizontal = () => { while (x !== to.x) { cells.add(key({ x, y })); x += Math.sign(to.x - x); } };
  const vertical = () => { while (y !== to.y) { cells.add(key({ x, y })); y += Math.sign(to.y - y); } };
  if (horizontalFirst) { horizontal(); vertical(); } else { vertical(); horizontal(); }
  cells.add(key(to));
}

function center(target: DungeonRoom): GridPosition {
  return { x: Math.floor(target.x + target.width / 2), y: Math.floor(target.y + target.height / 2) };
}

function interiorCells(target: DungeonRoom): GridPosition[] {
  const result: GridPosition[] = [];
  for (let y = target.y + 1; y < target.y + target.height - 1; y += 1) for (let x = target.x + 1; x < target.x + target.width - 1; x += 1) result.push({ x, y });
  return result;
}
