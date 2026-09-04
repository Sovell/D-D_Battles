import { heroClasses } from "../core/data/heroes";
import { monsters } from "../core/data/monsters";
import type { EncounterThemeId, GridPosition, HeroProfile, SavedScenario, ScenarioDefinition, ScenarioEventDefinition, ScenarioTemplateId, TerrainType } from "../core/domain/types";
import { validateDungeonMap } from "../core/map-generation/crypt-generator";
import { generateScenarioMap, type MapEnvironment } from "../core/map-generation/scenario-map";
import { createLegacyRoster, validateParty } from "../core/progression/hero-progression";
import { buildScenarioTemplate, scenarioTemplateById } from "../core/scenario/scenario-templates";
import { validateScenarioEvents } from "../core/scenario/scenario-events";
import { encounterThemeById, generateThemedEncounter, themeSupportsRoster } from "../core/scenario/encounter-themes";

export type SupportedScenarioPresetId = ScenarioTemplateId;

export interface ScenarioDraft {
  presetId: SupportedScenarioPresetId;
  name: string;
  seed: number;
  heroProfileIds: string[];
  monsterIds: string[];
  mapEnvironment: MapEnvironment;
  map: NonNullable<ScenarioDefinition["map"]>;
  events: ScenarioEventDefinition[];
  description: string;
  localAuthor: string;
  partyId: string;
  encounterThemeId: EncounterThemeId;
  encounterBudget: number;
  persistentRewards: boolean;
  mapMode: "fixed" | "regenerate";
  aiSettings: { enabled: boolean; doctrine: "adaptive" | "fixed" };
}

export type ScenarioMapTool = TerrainType | "hero-start" | "monster-start" | "objective";

export const availableHeroIds = heroClasses.map((hero) => hero.id);
export const availableMonsterIds = monsters.map((monster) => monster.id);

export function createDefaultScenarioDraft(seed = 3535): ScenarioDraft {
  const template = scenarioTemplateById.get("skirmish")!;
  return {
    presetId: template.id,
    name: template.name,
    seed,
    heroProfileIds: createLegacyRoster().map((profile) => profile.id),
    monsterIds: generateThemedEncounter("goblin-raid", 40, seed),
    mapEnvironment: template.environment,
    map: generateScenarioMap(seed, template.environment, template.requiresObjectives),
    events: structuredClone(template.events),
    description: template.description,
    localAuthor: "Lokalny gracz",
    partyId: "",
    encounterThemeId: "goblin-raid",
    encounterBudget: 40,
    persistentRewards: false,
    mapMode: "regenerate",
    aiSettings: { enabled: true, doctrine: "adaptive" },
  };
}

export function selectScenarioPreset(draft: ScenarioDraft, presetId: SupportedScenarioPresetId | "cleanse-the-crypt" | "interrupt-the-ritual"): ScenarioDraft {
  const normalizedId: SupportedScenarioPresetId = presetId === "cleanse-the-crypt" ? "skirmish" : presetId === "interrupt-the-ritual" ? "ritual-disruption" : presetId;
  const template = scenarioTemplateById.get(normalizedId)!;
  const encounterThemeId: EncounterThemeId = normalizedId === "ritual-disruption" ? "fiendish-ritual" : normalizedId === "rescue" ? "beast-hunt" : normalizedId === "escape" || normalizedId === "treasure-run" ? "dragons-lair" : "goblin-raid";
  const includeBoss = normalizedId === "ritual-disruption" || normalizedId === "assassinate";
  return { ...draft, presetId: normalizedId, name: template.name, description: template.description, encounterThemeId, monsterIds: generateThemedEncounter(encounterThemeId, draft.encounterBudget, draft.seed, includeBoss), mapEnvironment: template.environment, map: generateScenarioMap(draft.seed, template.environment, template.requiresObjectives), events: structuredClone(template.events) };
}

export function selectEncounterTheme(draft: ScenarioDraft, encounterThemeId: EncounterThemeId): ScenarioDraft {
  const theme = encounterThemeById.get(encounterThemeId)!;
  const presetId = theme.objectiveTypes.includes(draft.presetId) ? draft.presetId : theme.objectiveTypes[0];
  const template = scenarioTemplateById.get(presetId)!;
  const biome = theme.biomes[0];
  const mapEnvironment: MapEnvironment = biome === "crypt" || biome === "cave" ? "dungeon" : "outdoor";
  const includeBoss = presetId === "ritual-disruption" || presetId === "assassinate";
  const monsterIds = generateThemedEncounter(encounterThemeId, draft.encounterBudget, draft.seed, includeBoss);
  return { ...draft, presetId, name: template.name, description: template.description, events: structuredClone(template.events), encounterThemeId, monsterIds, mapEnvironment, map: generateScenarioMap(draft.seed, mapEnvironment, template.requiresObjectives) };
}

export function generateEncounterForBudget(draft: ScenarioDraft): ScenarioDraft {
  return { ...draft, monsterIds: generateThemedEncounter(draft.encounterThemeId, draft.encounterBudget, draft.seed, false) };
}

export function validateScenarioDraft(draft: ScenarioDraft, profiles: readonly HeroProfile[] = createLegacyRoster()): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(draft.seed)) errors.push("Seed musi być liczbą całkowitą.");
  if (draft.name.trim().length < 3) errors.push("Nazwa scenariusza musi mieć co najmniej 3 znaki.");
  errors.push(...validateParty(profiles, draft.heroProfileIds));
  if (draft.monsterIds.length < 1) errors.push("Spotkanie musi zawierać co najmniej jednego potwora.");
  if (draft.monsterIds.some((id) => !availableMonsterIds.includes(id))) errors.push("Spotkanie zawiera nieznanego potwora.");
  if (!themeSupportsRoster(draft.encounterThemeId, draft.monsterIds)) errors.push("Roster musi składać się wyłącznie z istot pasujących do wybranego motywu.");
  if (!encounterThemeById.get(draft.encounterThemeId)?.objectiveTypes.includes(draft.presetId)) errors.push("Wybrany cel nie pasuje do motywu spotkania.");
  if (draft.presetId === "ritual-disruption" && draft.encounterThemeId !== "undead-crypt" && draft.monsterIds.filter((id) => id === "ritualist").length !== 1) errors.push("Scenariusz rytuału wymaga dokładnie jednego rytualisty.");
  if (draft.presetId === "assassinate" && !draft.monsterIds.includes("hobgoblin-captain")) errors.push("Scenariusz zabójstwa wymaga Hobgoblin Captaina.");
  const mapValidation = validateDungeonMap(draft.map, draft.heroProfileIds.length, 1);
  if (!mapValidation.valid) errors.push(`Mapa jest nieprawidłowa: ${mapValidation.errors.join(", ")}.`);
  const freeCapacity = draft.map.cells.filter((cell) => cell.terrain !== "wall").length - draft.heroProfileIds.length - draft.map.objectives.length;
  if (draft.monsterIds.length > freeCapacity) errors.push("Mapa nie ma wystarczającej liczby wolnych pól dla wszystkich potworów.");
  if (scenarioTemplateById.get(draft.presetId)?.requiresObjectives && draft.map.objectives.length < 1) errors.push("Ten szablon wymaga co najmniej jednego celu na mapie.");
  if (!validateScenarioEvents(draft.events)) errors.push("Konfiguracja wydarzeń scenariusza jest nieprawidłowa.");
  if (draft.events.some((event) => event.trigger.type === "unit-entered-cell" && !isOnMap(draft, event.trigger.position))) errors.push("Wydarzenie wskazuje pole poza mapą.");
  return errors;
}

export function buildScenarioFromDraft(draft: ScenarioDraft, profiles: readonly HeroProfile[] = createLegacyRoster()): ScenarioDefinition {
  const errors = validateScenarioDraft(draft, profiles);
  if (errors.length) throw new Error(errors.join(" "));
  const preset = buildScenarioTemplate(draft.presetId, draft.map, draft.name);
  const undeadRitual = draft.presetId === "ritual-disruption" && draft.encounterThemeId === "undead-crypt";
  return {
    ...preset,
    name: draft.name.trim(),
    theme: draft.map.theme,
    map: structuredClone(draft.map),
    events: structuredClone(draft.events),
    encounter: {
      ...preset.encounter,
      id: `custom-${draft.presetId}-${draft.seed}`,
      name: `Własne spotkanie: ${preset.name}`,
      monsters: [...draft.monsterIds],
    },
    description: draft.description.trim() || preset.description,
    persistentRewards: draft.persistentRewards,
    encounterThemeId: draft.encounterThemeId,
    ...(undeadRitual ? { victoryCondition: "template-rules" as const, victoryRules: { type: "unit-defeated" as const, definitionId: "wraith" } } : {}),
  };
}

export function setMonsterCount(draft: ScenarioDraft, monsterId: string, count: number): ScenarioDraft {
  const retained = draft.monsterIds.filter((id) => id !== monsterId);
  const desired = Math.max(0, Math.floor(count));
  return { ...draft, monsterIds: [...retained, ...Array.from({ length: desired }, () => monsterId)] };
}

export function regenerateScenarioMap(draft: ScenarioDraft, mapEnvironment = draft.mapEnvironment): ScenarioDraft {
  const withObjectives = scenarioTemplateById.get(draft.presetId)?.requiresObjectives ?? false;
  return { ...draft, mapEnvironment, map: generateScenarioMap(draft.seed, mapEnvironment, withObjectives) };
}

export function draftFromSavedScenario(saved: SavedScenario, heroProfileIds: string[], partyId: string): ScenarioDraft {
  const map = structuredClone(saved.map);
  if (saved.mapMode === "fixed" && saved.monsterPositions?.length) map.monsterStart = structuredClone(saved.monsterPositions);
  return { presetId: saved.presetId, name: saved.name, seed: saved.baseSeed, heroProfileIds, monsterIds: [...saved.monsterIds], mapEnvironment: saved.mapEnvironment, map, events: structuredClone(saved.events), description: saved.description, localAuthor: saved.localAuthor, partyId, encounterThemeId: saved.encounterThemeId, encounterBudget: saved.encounterBudget, persistentRewards: saved.persistentRewards, mapMode: saved.mapMode, aiSettings: structuredClone(saved.aiSettings) };
}

export function savedScenarioFromDraft(draft: ScenarioDraft, id = `scenario-${Date.now()}`): SavedScenario {
  return { schemaVersion: 1, id, name: draft.name.trim(), description: draft.description.trim(), localAuthor: draft.localAuthor.trim() || "Lokalny gracz", createdAt: new Date().toISOString(), presetId: draft.presetId, encounterThemeId: draft.encounterThemeId, aiSettings: structuredClone(draft.aiSettings), encounterBudget: draft.encounterBudget, monsterIds: [...draft.monsterIds], monsterPositions: draft.mapMode === "fixed" && draft.map.monsterStart.length >= draft.monsterIds.length ? draft.map.monsterStart.slice(0, draft.monsterIds.length) : undefined, persistentRewards: draft.persistentRewards, mapMode: draft.mapMode, baseSeed: draft.seed, mapEnvironment: draft.mapEnvironment, map: structuredClone(draft.map), events: structuredClone(draft.events) };
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
