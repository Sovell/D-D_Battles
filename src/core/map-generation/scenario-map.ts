import type { DungeonMap, DungeonRoom, GridPosition, MapCell, TerrainType } from "../domain/types";
import { createRandom } from "../random/random";
import { generateCrypt, validateDungeonMap } from "./crypt-generator";

export type MapEnvironment = "dungeon" | "outdoor" | "interior";

export function generateScenarioMap(seed: number, environment: MapEnvironment, withObjectives: boolean): DungeonMap {
  if (environment === "dungeon") {
    const map = generateCrypt(seed);
    return withObjectives ? map : removeObjectives(map);
  }
  const map = environment === "outdoor" ? generateOutdoor(seed, withObjectives) : generateInterior(seed, withObjectives);
  const validation = validateDungeonMap(map);
  if (!validation.valid) throw new Error(`Generated scenario map is invalid: ${validation.errors.join(", ")}`);
  return map;
}

function generateOutdoor(seed: number, withObjectives: boolean): DungeonMap {
  const width = 18;
  const height = 12;
  const random = createRandom(seed ^ 0x41c64e6d);
  const heroStart = verticalStarts(1, 4, 4);
  const monsterStart = verticalStarts(16, 3, 5);
  const objectives = withObjectives ? objectivesAt([{ x: 8, y: 3 }, { x: 10, y: 8 }]) : [];
  const protectedCells = new Set([...heroStart, ...monsterStart, ...objectives.map((item) => item.position)].map(key));
  const cells: MapCell[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const position = { x, y };
    let terrain: TerrainType = "floor";
    if ((x === 0 || x === width - 1) && y % 3 !== 1) terrain = "wall";
    if (!protectedCells.has(key(position)) && terrain === "floor") {
      const roll = random.next();
      if (roll < 0.07) terrain = "cover";
      else if (roll < 0.13) terrain = "rubble";
      else if (roll < 0.17) terrain = "highGround";
      else if (roll < 0.19) terrain = "hazard";
    }
    cells.push({ position, terrain });
  }
  attachObjectives(cells, objectives);
  return { id: `outdoor-${seed}`, seed, theme: "ruins", width, height, cells, rooms: [{ id: "open-ground", x: 0, y: 0, width, height }], heroStart, monsterStart, objectives };
}

function generateInterior(seed: number, withObjectives: boolean): DungeonMap {
  const width = 18;
  const height = 12;
  const heroStart = verticalStarts(2, 4, 4);
  const monsterStart = verticalStarts(15, 3, 5);
  const objectives = withObjectives ? objectivesAt([{ x: 9, y: 3 }, { x: 9, y: 8 }]) : [];
  const protectedCells = new Set([...heroStart, ...monsterStart, ...objectives.map((item) => item.position)].map(key));
  const cells: MapCell[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const position = { x, y };
    const outerWall = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const divider = (x === 6 || x === 12) && ![3, 8].includes(y);
    const crossWall = y === 6 && x > 6 && x < 12 && x !== 9;
    let terrain: TerrainType = outerWall || divider || crossWall ? "wall" : "floor";
    if (!protectedCells.has(key(position)) && terrain === "floor" && ((x * 17 + y * 31 + seed) % 29 === 0)) terrain = "cover";
    cells.push({ position, terrain });
  }
  attachObjectives(cells, objectives);
  const rooms: DungeonRoom[] = [
    { id: "west-wing", x: 1, y: 1, width: 5, height: 10 },
    { id: "great-hall", x: 7, y: 1, width: 5, height: 10 },
    { id: "east-wing", x: 13, y: 1, width: 4, height: 10 },
  ];
  return { id: `interior-${seed}`, seed, theme: "crypt", width, height, cells, rooms, heroStart, monsterStart, objectives };
}

function removeObjectives(map: DungeonMap): DungeonMap {
  return { ...map, cells: map.cells.map(({ objectiveId: _objectiveId, ...cell }) => cell), objectives: [] };
}

function objectivesAt(positions: GridPosition[]) {
  return positions.map((position, index) => ({ id: `scenario-objective-${index + 1}`, position, hp: 8 }));
}

function attachObjectives(cells: MapCell[], objectives: DungeonMap["objectives"]): void {
  for (const objective of objectives) {
    const cell = cells.find((candidate) => key(candidate.position) === key(objective.position));
    if (cell) cell.objectiveId = objective.id;
  }
}

function verticalStarts(x: number, y: number, count: number): GridPosition[] {
  return Array.from({ length: count }, (_, index) => ({ x, y: y + index }));
}

function key(position: GridPosition): string { return `${position.x},${position.y}`; }
