import { heroClasses } from "../core/data/heroes";
import { monsters } from "../core/data/monsters";
import type { GridPosition, ScenarioDefinition, ScenarioEventDefinition, TerrainType } from "../core/domain/types";
import { validateDungeonMap } from "../core/map-generation/crypt-generator";
import { generateScenarioMap, type MapEnvironment } from "../core/map-generation/scenario-map";
import { cleanseTheCrypt, interruptTheRitual } from "../core/scenario/scenarios";
import { validateScenarioEvents } from "../core/scenario/scenario-events";

export type SupportedScenarioPresetId = "cleanse-the-crypt" | "interrupt-the-ritual";

export interface ScenarioDraft {
  presetId: SupportedScenarioPresetId;
  name: string;
  seed: number;
  heroIds: string[];
  heroVariants: Record<string, number>;
  monsterIds: string[];
  mapEnvironment: MapEnvironment;
  map: NonNullable<ScenarioDefinition["map"]>;
  events: ScenarioEventDefinition[];
}

export type ScenarioMapTool = TerrainType | "hero-start" | "monster-start" | "objective";

export const availableHeroIds = heroClasses.map((hero) => hero.id);
export const availableMonsterIds = monsters.filter((monster) => monster.id !== "owlbear").map((monster) => monster.id);

export function createDefaultScenarioDraft(seed = 3535): ScenarioDraft {
  return {
    presetId: "cleanse-the-crypt",
    name: cleanseTheCrypt.name,
    seed,
    heroIds: ["fighter", "rogue", "cleric", "wizard"],
    heroVariants: { fighter: 0, rogue: 0, cleric: 0, wizard: 0 },
    monsterIds: [...cleanseTheCrypt.encounter.monsters],
    mapEnvironment: "dungeon",
    map: generateScenarioMap(seed, "dungeon", true),
    events: structuredClone(cleanseTheCrypt.events ?? []),
  };
}

export function selectScenarioPreset(draft: ScenarioDraft, presetId: SupportedScenarioPresetId): ScenarioDraft {
  const preset = presetId === "interrupt-the-ritual" ? interruptTheRitual : cleanseTheCrypt;
  const mapEnvironment: MapEnvironment = presetId === "interrupt-the-ritual" ? "outdoor" : "dungeon";
  return { ...draft, presetId, name: preset.name, monsterIds: [...preset.encounter.monsters], mapEnvironment, map: generateScenarioMap(draft.seed, mapEnvironment, preset.victoryCondition === "destroy-foci-and-undead"), events: structuredClone(preset.events ?? []) };
}

export function validateScenarioDraft(draft: ScenarioDraft): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(draft.seed)) errors.push("Seed musi być liczbą całkowitą.");
  if (draft.name.trim().length < 3) errors.push("Nazwa scenariusza musi mieć co najmniej 3 znaki.");
  if (draft.heroIds.length < 3 || draft.heroIds.length > 4) errors.push("Drużyna musi mieć 3–4 bohaterów.");
  if (new Set(draft.heroIds).size !== draft.heroIds.length) errors.push("Nie można wybrać tej samej klasy dwa razy.");
  if (draft.heroIds.some((id) => !availableHeroIds.includes(id))) errors.push("Drużyna zawiera nieznaną klasę.");
  if (draft.heroIds.some((id) => !Number.isInteger(draft.heroVariants[id]) || draft.heroVariants[id] < 0 || draft.heroVariants[id] > 2)) errors.push("Każdy bohater musi mieć wybrany wariant portretu.");
  if (draft.monsterIds.length < 1) errors.push("Spotkanie musi zawierać co najmniej jednego potwora.");
  if (draft.monsterIds.some((id) => !availableMonsterIds.includes(id))) errors.push("Spotkanie zawiera nieznanego potwora.");
  if (draft.presetId === "interrupt-the-ritual" && draft.monsterIds.filter((id) => id === "ritualist").length !== 1) errors.push("Scenariusz rytuału wymaga dokładnie jednego rytualisty.");
  const mapValidation = validateDungeonMap(draft.map, draft.heroIds.length, 1);
  if (!mapValidation.valid) errors.push(`Mapa jest nieprawidłowa: ${mapValidation.errors.join(", ")}.`);
  const freeCapacity = draft.map.cells.filter((cell) => cell.terrain !== "wall").length - draft.heroIds.length - draft.map.objectives.length;
  if (draft.monsterIds.length > freeCapacity) errors.push("Mapa nie ma wystarczającej liczby wolnych pól dla wszystkich potworów.");
  if (draft.presetId === "cleanse-the-crypt" && draft.map.objectives.length < 1) errors.push("Scenariusz oczyszczania wymaga co najmniej jednego celu.");
  if (!validateScenarioEvents(draft.events)) errors.push("Konfiguracja wydarzeń scenariusza jest nieprawidłowa.");
  if (draft.events.some((event) => event.trigger.type === "unit-entered-cell" && !isOnMap(draft, event.trigger.position))) errors.push("Wydarzenie wskazuje pole poza mapą.");
  return errors;
}

export function setHeroVariant(draft: ScenarioDraft, heroId: string, variant: number): ScenarioDraft {
  if (!availableHeroIds.includes(heroId)) return draft;
  return { ...draft, heroVariants: { ...draft.heroVariants, [heroId]: Math.max(0, Math.min(2, Math.floor(variant))) } };
}

export function buildScenarioFromDraft(draft: ScenarioDraft): ScenarioDefinition {
  const errors = validateScenarioDraft(draft);
  if (errors.length) throw new Error(errors.join(" "));
  const preset = draft.presetId === "interrupt-the-ritual" ? interruptTheRitual : cleanseTheCrypt;
  return {
    ...preset,
    name: draft.name.trim(),
    theme: draft.map.theme,
    map: structuredClone(draft.map),
    events: structuredClone(draft.events),
    encounter: {
      ...preset.encounter,
      id: `custom-${draft.presetId}-${draft.seed}`,
      name: draft.presetId === "interrupt-the-ritual" ? "Rytualista i wybrana eskorta" : "Własne spotkanie w krypcie",
      monsters: [...draft.monsterIds],
    },
  };
}

export function setMonsterCount(draft: ScenarioDraft, monsterId: string, count: number): ScenarioDraft {
  const retained = draft.monsterIds.filter((id) => id !== monsterId);
  const desired = Math.max(0, Math.floor(count));
  return { ...draft, monsterIds: [...retained, ...Array.from({ length: desired }, () => monsterId)] };
}

export function regenerateScenarioMap(draft: ScenarioDraft, mapEnvironment = draft.mapEnvironment): ScenarioDraft {
  const withObjectives = draft.presetId === "cleanse-the-crypt";
  return { ...draft, mapEnvironment, map: generateScenarioMap(draft.seed, mapEnvironment, withObjectives) };
}

export function editScenarioMapCell(draft: ScenarioDraft, position: GridPosition, tool: ScenarioMapTool): ScenarioDraft {
  if (!isOnMap(draft, position)) return draft;
  const targetKey = key(position);
  const removeMarker = (positions: GridPosition[]) => positions.filter((candidate) => key(candidate) !== targetKey);
  let map = structuredClone(draft.map);
  if (["hero-start", "monster-start", "objective"].includes(tool)) {
    map.cells = map.cells.map((cell) => key(cell.position) === targetKey ? { ...cell, terrain: cell.terrain === "wall" ? "floor" : cell.terrain } : cell);
  }
  if (tool === "hero-start") {
    const exists = map.heroStart.some((candidate) => key(candidate) === targetKey);
    map.heroStart = exists ? removeMarker(map.heroStart) : [...removeMarker(map.heroStart), position].slice(-4);
    map.monsterStart = removeMarker(map.monsterStart);
    map = removeObjective(map, targetKey);
  } else if (tool === "monster-start") {
    const exists = map.monsterStart.some((candidate) => key(candidate) === targetKey);
    map.monsterStart = exists ? removeMarker(map.monsterStart) : [...removeMarker(map.monsterStart), position];
    map.heroStart = removeMarker(map.heroStart);
    map = removeObjective(map, targetKey);
  } else if (tool === "objective") {
    const existing = map.objectives.find((objective) => key(objective.position) === targetKey);
    map.heroStart = removeMarker(map.heroStart);
    map.monsterStart = removeMarker(map.monsterStart);
    if (existing) map = removeObjective(map, targetKey);
    else {
      const id = uniqueObjectiveId(map.objectives.map((objective) => objective.id));
      map.objectives.push({ id, position, hp: 8 });
      map.cells = map.cells.map((cell) => key(cell.position) === targetKey ? { ...cell, objectiveId: id } : cell);
    }
  } else {
    map.cells = map.cells.map((cell) => key(cell.position) === targetKey ? { ...cell, terrain: tool, ...(tool === "wall" ? { objectiveId: undefined } : {}) } : cell);
    if (tool === "wall") {
      map.heroStart = removeMarker(map.heroStart);
      map.monsterStart = removeMarker(map.monsterStart);
      map = removeObjective(map, targetKey);
    }
  }
  return { ...draft, map: { ...map, id: `custom-${draft.mapEnvironment}-${draft.seed}` } };
}

function removeObjective(map: ScenarioDraft["map"], targetKey: string): ScenarioDraft["map"] {
  return {
    ...map,
    objectives: map.objectives.filter((objective) => key(objective.position) !== targetKey),
    cells: map.cells.map((cell) => key(cell.position) === targetKey ? { ...cell, objectiveId: undefined } : cell),
  };
}

function uniqueObjectiveId(ids: string[]): string {
  let index = 1;
  while (ids.includes(`custom-objective-${index}`)) index += 1;
  return `custom-objective-${index}`;
}

function isOnMap(draft: ScenarioDraft, position: GridPosition): boolean { return position.x >= 0 && position.x < draft.map.width && position.y >= 0 && position.y < draft.map.height; }
function key(position: GridPosition): string { return `${position.x},${position.y}`; }
