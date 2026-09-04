import type { EncounterThemeId, SavedScenario, ScenarioTemplateId } from "../domain/types";
import { monsterById } from "../data/monsters";
import { generateScenarioMap } from "../map-generation/scenario-map";
import { encounterThemeById, themeSupportsRoster } from "./encounter-themes";

export const SAVED_SCENARIO_SCHEMA_VERSION = 1;

export function serializeSavedScenario(scenario: SavedScenario): string {
  return JSON.stringify(scenario, null, 2);
}

export function parseSavedScenario(raw: string): { ok: true; value: SavedScenario } | { ok: false; errors: string[] } {
  try {
    const value: unknown = JSON.parse(raw);
    const errors = validateSavedScenario(value);
    return errors.length ? { ok: false, errors } : { ok: true, value: structuredClone(value as SavedScenario) };
  } catch { return { ok: false, errors: ["Plik nie jest poprawnym JSON-em."] }; }
}

export function validateSavedScenario(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Brak obiektu scenariusza."];
  const item = value as Partial<SavedScenario>;
  const errors: string[] = [];
  if (item.schemaVersion !== SAVED_SCENARIO_SCHEMA_VERSION) errors.push("Nieobsługiwana wersja schematu.");
  if (!item.id || !item.name || !item.description || !item.localAuthor || !item.createdAt) errors.push("Brak wymaganych metadanych.");
  if (!encounterThemeById.has(item.encounterThemeId as EncounterThemeId)) errors.push("Nieznany motyw spotkania.");
  const presetIds: ScenarioTemplateId[] = ["skirmish", "hold-the-line", "breakthrough", "assassinate", "rescue", "ritual-disruption", "escape", "treasure-run"];
  if (!presetIds.includes(item.presetId as ScenarioTemplateId)) errors.push("Nieznany typ celu.");
  else if (!encounterThemeById.get(item.encounterThemeId as EncounterThemeId)?.objectiveTypes.includes(item.presetId as ScenarioTemplateId)) errors.push("Cel nie pasuje do motywu.");
  if (!Array.isArray(item.monsterIds) || !item.monsterIds.length || item.monsterIds.some((id) => !monsterById.has(id))) errors.push("Roster zawiera nieznane potwory.");
  else if (!themeSupportsRoster(item.encounterThemeId as EncounterThemeId, item.monsterIds)) errors.push("Roster nie jest spójny z motywem.");
  if (!isSavedMap(item.map) || !Number.isInteger(item.baseSeed) || !["fixed", "regenerate"].includes(String(item.mapMode)) || !["dungeon", "outdoor", "interior"].includes(String(item.mapEnvironment))) errors.push("Nieprawidłowe ustawienia mapy.");
  if (item.monsterPositions !== undefined && (!Array.isArray(item.monsterPositions) || item.monsterPositions.length < (item.monsterIds?.length ?? 0) || item.monsterPositions.some((position) => !position || !Number.isInteger(position.x) || !Number.isInteger(position.y)))) errors.push("Nieprawidłowe pozycje potworów.");
  if (!Number.isFinite(item.encounterBudget) || Number(item.encounterBudget) <= 0) errors.push("Budżet spotkania musi być dodatni.");
  if (!item.aiSettings || typeof item.aiSettings.enabled !== "boolean" || !["adaptive", "fixed"].includes(String(item.aiSettings.doctrine))) errors.push("Nieprawidłowe ustawienia AI.");
  if (!Array.isArray(item.events) || item.events.some((event) => !event || typeof event.id !== "string" || typeof event.name !== "string" || !event.trigger || !event.effect)) errors.push("Nieprawidłowe wydarzenia.");
  return errors;
}

function isSavedMap(map: unknown): boolean {
  if (!map || typeof map !== "object") return false;
  const value = map as SavedScenario["map"];
  return typeof value.id === "string" && Number.isInteger(value.seed) && Number.isInteger(value.width) && value.width > 0 && Number.isInteger(value.height) && value.height > 0 && ["crypt", "cave", "ruins"].includes(value.theme) && Array.isArray(value.cells) && value.cells.length === value.width * value.height && Array.isArray(value.rooms) && Array.isArray(value.heroStart) && Array.isArray(value.monsterStart) && Array.isArray(value.objectives);
}

export function duplicateSavedScenario(source: SavedScenario, now = new Date().toISOString()): SavedScenario {
  return { ...structuredClone(source), id: `${source.id}-copy-${Date.now()}`, name: `${source.name} — kopia`, createdAt: now };
}

const example = (id: string, name: string, description: string, presetId: ScenarioTemplateId, encounterThemeId: EncounterThemeId, monsterIds: string[], seed: number, environment: SavedScenario["mapEnvironment"], budget: number): SavedScenario => ({
  schemaVersion: 1, id, name, description, localAuthor: "D&D Battles", createdAt: "2026-09-04T00:00:00.000Z", presetId, encounterThemeId,
  aiSettings: { enabled: true, doctrine: "adaptive" }, encounterBudget: budget, monsterIds, persistentRewards: true, mapMode: "regenerate", baseSeed: seed,
  mapEnvironment: environment, map: generateScenarioMap(seed, environment, presetId === "treasure-run" || presetId === "rescue"), events: [],
});

export function exampleSavedScenarios(): SavedScenario[] {
  return [
    example("example-goblin-defense", "Obrona przed Goblin Raid", "Utrzymaj pozycję wobec zwartego goblińskiego najazdu.", "hold-the-line", "goblin-raid", ["goblin", "goblin", "worg", "hobgoblin-captain"], 4101, "outdoor", 42),
    example("example-undead-ritual", "Undead Crypt: przerwanie rytuału", "Przedrzyj się przez strażników krypty i przerwij mroczną ceremonię.", "ritual-disruption", "undead-crypt", ["skeleton", "skeleton", "zombie", "ghoul", "wraith"], 4102, "dungeon", 68),
    example("example-hard-beast", "Hard Beast Hunt", "Niebezpieczne polowanie na drapieżniki kontrolujące teren.", "skirmish", "beast-hunt", ["giant-spider", "dire-wolf", "dire-wolf", "manticore"], 4103, "outdoor", 55),
    example("example-class-showcase", "Próba nowych klas", "Polowanie zaprojektowane jako poligon dla kontroli terenu, mobilności, wsparcia i ataków tagowych nowych klas.", "rescue", "beast-hunt", ["giant-spider", "dire-wolf", "owlbear"], 4104, "outdoor", 48),
  ];
}
