import type { DungeonMap, DungeonRoom, GridPosition, MapCell, TerrainType } from "../domain/types";
import { createRandom, type RandomSource } from "../random/random";

const key = ({ x, y }: GridPosition) => `${x},${y}`;

export function generateCrypt(seed: number, width = 18, height = 12): DungeonMap {
  const random = createRandom(seed);
  const layout = createCryptLayout(random);
  const rooms = layout.rooms;
  const floors = new Set<string>();
  for (const room of rooms) carveRoom(floors, room);
  for (const [from, to] of layout.connections) carveCorridor(floors, center(rooms[from]), center(rooms[to]), random.next() < 0.5);

  const heroStart = interiorCells(rooms[0]).slice(0, 4);
  const monsterStart = interiorCells(rooms.at(-1)!).slice(-5);
  const objectives = [
    { id: "necromantic-focus-a", position: interiorCells(rooms[Math.floor(rooms.length / 2)])[0], hp: 8 },
    { id: "necromantic-focus-b", position: interiorCells(rooms.at(-1)!)[0], hp: 8 },
  ];
  const protectedCells = new Set([...heroStart, ...monsterStart, ...objectives.map((objective) => objective.position)].map(key));

  const cells: MapCell[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const position = { x, y };
    let terrain: TerrainType = floors.has(key(position)) ? "floor" : "wall";
    if (terrain === "floor" && !protectedCells.has(key(position)) && random.next() < 0.065) terrain = random.next() < 0.5 ? "rubble" : "cover";
    cells.push({ position, terrain });
  }

  for (const objective of objectives) {
    const cell = cells.find((candidate) => key(candidate.position) === key(objective.position));
    if (cell) cell.objectiveId = objective.id;
  }
  const map = { id: `crypt-${seed}`, seed, theme: "crypt" as const, width, height, cells, rooms, heroStart, monsterStart, objectives };
  if (!validateDungeonMap(map).valid) throw new Error("Generated crypt is invalid");
  return map;
}

interface CryptLayout {
  rooms: DungeonRoom[];
  connections: Array<[number, number]>;
}

function createCryptLayout(random: RandomSource): CryptLayout {
  const variant = random.int(0, 2);
  if (variant === 0) {
    const upperEntry = random.next() < 0.5;
    return {
      rooms: [
        makeRoom("entry", 1, upperEntry ? 1 : 6, 5, 5),
        makeRoom("ossuary", 7, 1, 4, 4),
        makeRoom("burial-vault", 7, 7, 4, 4),
        makeRoom("sanctum", 13, upperEntry ? 5 : 2, 4, 6),
      ],
      connections: [[0, 1], [0, 2], [1, 3], [2, 3]],
    };
  }
  if (variant === 1) {
    const descending = random.next() < 0.5;
    return {
      rooms: [
        makeRoom("entry", 1, descending ? 1 : 7, 5, 4),
        makeRoom("processional-hall", 5, descending ? 6 : 2, 4, 5),
        makeRoom("sealed-vault", 10, descending ? 1 : 7, 4, 4),
        makeRoom("sanctum", 13, descending ? 6 : 1, 4, 5),
      ],
      connections: [[0, 1], [1, 2], [2, 3]],
    };
  }
  const entryHigh = random.next() < 0.5;
  return {
    rooms: [
      makeRoom("entry", 1, entryHigh ? 2 : 6, 4, 5),
      makeRoom("western-tombs", 5, entryHigh ? 7 : 1, 4, 4),
      makeRoom("nave", 8, 4, 4, 4),
      makeRoom("eastern-tombs", 11, entryHigh ? 1 : 7, 4, 4),
      makeRoom("sanctum", 13, entryHigh ? 6 : 1, 4, 5),
    ],
    connections: [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4]],
  };
}

function makeRoom(id: string, x: number, y: number, width: number, height: number): DungeonRoom {
  return { id, x, y, width, height };
}

function carveRoom(cells: Set<string>, room: DungeonRoom): void {
  for (let y = room.y; y < room.y + room.height; y += 1) for (let x = room.x; x < room.x + room.width; x += 1) cells.add(key({ x, y }));
}

function carveCorridor(cells: Set<string>, from: GridPosition, to: GridPosition, horizontalFirst: boolean): void {
  let { x, y } = from;
  const horizontal = () => { while (x !== to.x) { cells.add(key({ x, y })); x += Math.sign(to.x - x); } };
  const vertical = () => { while (y !== to.y) { cells.add(key({ x, y })); y += Math.sign(to.y - y); } };
  if (horizontalFirst) { horizontal(); vertical(); } else { vertical(); horizontal(); }
  cells.add(key(to));
}

function center(room: DungeonRoom): GridPosition { return { x: Math.floor(room.x + room.width / 2), y: Math.floor(room.y + room.height / 2) }; }
function interiorCells(room: DungeonRoom): GridPosition[] {
  const result: GridPosition[] = [];
  for (let y = room.y + 1; y < room.y + room.height - 1; y += 1) for (let x = room.x + 1; x < room.x + room.width - 1; x += 1) result.push({ x, y });
  return result;
}

export function validateDungeonMap(map: DungeonMap): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const starts = [...map.heroStart, ...map.monsterStart];
  if (new Set(starts.map(key)).size !== starts.length) errors.push("start zones overlap");
  const reachable = flood(map, map.heroStart[0]);
  for (const position of [...starts, ...map.objectives.map((objective) => objective.position)]) if (!reachable.has(key(position))) errors.push(`unreachable ${key(position)}`);
  if (map.heroStart.length < 4 || map.monsterStart.length < 5) errors.push("insufficient start cells");
  return { valid: errors.length === 0, errors };
}

function flood(map: DungeonMap, start: GridPosition): Set<string> {
  const passable = new Set(map.cells.filter((cell) => cell.terrain !== "wall").map((cell) => key(cell.position)));
  const visited = new Set<string>([key(start)]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbors(current)) if (passable.has(key(next)) && !visited.has(key(next))) { visited.add(key(next)); queue.push(next); }
  }
  return visited;
}

export function neighbors(position: GridPosition): GridPosition[] {
  return [{ x: position.x + 1, y: position.y }, { x: position.x - 1, y: position.y }, { x: position.x, y: position.y + 1 }, { x: position.x, y: position.y - 1 }];
}
