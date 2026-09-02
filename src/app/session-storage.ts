import type { BattleState } from "../core/domain/types";
import { availableHeroIds, createDefaultScenarioDraft, selectScenarioPreset, type ScenarioDraft, type SupportedScenarioPresetId } from "./scenario-builder-model";

const BATTLE_KEY = "dnd-battles.battle.v1";
const BATTLE_SAVES_KEY = "dnd-battles.manual-saves.v1";
const DRAFT_KEY = "dnd-battles.scenario-draft.v1";

export type AppScreen = "menu" | "builder" | "battle";

export interface SavedBattleSession {
  schemaVersion: 1;
  savedAt: string;
  seed: number;
  heroIds: string[];
  state: BattleState;
}

export interface NamedBattleSave extends SavedBattleSession {
  id: string;
  name: string;
}

export function loadBattleSession(): SavedBattleSession | null {
  return parseBattleSession(read(BATTLE_KEY));
}

export function saveBattleSession(seed: number, heroIds: string[], state: BattleState): void {
  write(BATTLE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), seed, heroIds, state } satisfies SavedBattleSession));
}

export function parseBattleSession(raw: string | null): SavedBattleSession | null {
  const value = parseObject(raw);
  return parseBattleSessionValue(value);
}

export function createManualBattleSave(seed: number, heroIds: string[], state: BattleState): NamedBattleSave {
  const savedAt = new Date().toISOString();
  const save: NamedBattleSave = {
    schemaVersion: 1,
    id: `battle-${Date.now()}`,
    name: `${state.scenario.name} · runda ${state.round}`,
    savedAt,
    seed,
    heroIds: [...heroIds],
    state,
  };
  const saves = [save, ...loadManualBattleSaves()].slice(0, 20);
  write(BATTLE_SAVES_KEY, JSON.stringify(saves));
  return save;
}

export function loadManualBattleSaves(): NamedBattleSave[] {
  return parseBattleSaveList(read(BATTLE_SAVES_KEY));
}

export function parseBattleSaveList(raw: string | null): NamedBattleSave[] {
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values.flatMap((value) => {
      const session = parseBattleSessionValue(value && typeof value === "object" ? value as Record<string, unknown> : null);
      const named = value as Record<string, unknown>;
      return session && typeof named.id === "string" && typeof named.name === "string" ? [{ ...session, id: named.id, name: named.name }] : [];
    });
  } catch {
    return [];
  }
}

function parseBattleSessionValue(value: Record<string, unknown> | null): SavedBattleSession | null {
  if (!value || value.schemaVersion !== 1 || typeof value.savedAt !== "string" || !Number.isInteger(value.seed)) return null;
  if (!isStringArray(value.heroIds) || !isBattleState(value.state)) return null;
  return value as unknown as SavedBattleSession;
}

export function loadScenarioDraft(): ScenarioDraft | null {
  return parseScenarioDraft(read(DRAFT_KEY));
}

export function saveScenarioDraft(draft: ScenarioDraft): void {
  write(DRAFT_KEY, JSON.stringify(draft));
}

export function parseScenarioDraft(raw: string | null): ScenarioDraft | null {
  const value = parseObject(raw);
  if (!value || !["cleanse-the-crypt", "interrupt-the-ritual"].includes(String(value.presetId))) return null;
  if (typeof value.name !== "string" || !Number.isInteger(value.seed) || !isStringArray(value.heroIds) || !isStringArray(value.monsterIds)) return null;
  const presetId = value.presetId as SupportedScenarioPresetId;
  const migrated = selectScenarioPreset(createDefaultScenarioDraft(Number(value.seed)), presetId);
  const variants = value.heroVariants && typeof value.heroVariants === "object" ? value.heroVariants as Record<string, unknown> : {};
  const heroVariants = Object.fromEntries(availableHeroIds.map((id) => [id, Number.isInteger(variants[id]) ? Math.max(0, Math.min(2, Number(variants[id]))) : 0]));
  const mapEnvironment = ["dungeon", "outdoor", "interior"].includes(String(value.mapEnvironment)) ? value.mapEnvironment as ScenarioDraft["mapEnvironment"] : migrated.mapEnvironment;
  const map = isDungeonMap(value.map) ? value.map as ScenarioDraft["map"] : migrated.map;
  const events = isScenarioEventList(value.events) ? value.events as ScenarioDraft["events"] : migrated.events;
  return { ...migrated, ...value, presetId, heroVariants, mapEnvironment, map, events } as ScenarioDraft;
}

function isBattleState(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (!Number.isInteger(state.seed) || !Number.isInteger(state.randomState) || !Number.isInteger(state.activeIndex) || !Number.isInteger(state.round)) return false;
  if (!["active", "victory", "defeat"].includes(String(state.outcome))) return false;
  if (!Array.isArray(state.combatants) || !Array.isArray(state.initiativeOrder) || !Array.isArray(state.objectives) || !Array.isArray(state.log)) return false;
  if (!state.scenario || typeof state.scenario !== "object" || !state.map || typeof state.map !== "object") return false;
  const map = state.map as Record<string, unknown>;
  if (!Array.isArray(map.cells) || !Array.isArray(map.rooms) || !Array.isArray(map.heroStart) || !Array.isArray(map.monsterStart)) return false;
  return state.combatants.every((unit) => {
    if (!unit || typeof unit !== "object") return false;
    const combatant = unit as Record<string, unknown>;
    return typeof combatant.id === "string" && typeof combatant.hp === "number" && isPosition(combatant.position);
  });
}

function isPosition(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const position = value as Record<string, unknown>;
  return Number.isInteger(position.x) && Number.isInteger(position.y);
}

function isDungeonMap(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const map = value as Record<string, unknown>;
  return typeof map.id === "string" && Number.isInteger(map.seed) && Number.isInteger(map.width) && Number.isInteger(map.height)
    && ["crypt", "cave", "ruins"].includes(String(map.theme)) && Array.isArray(map.cells) && Array.isArray(map.rooms)
    && Array.isArray(map.heroStart) && Array.isArray(map.monsterStart) && Array.isArray(map.objectives);
}

function isScenarioEventList(value: unknown): boolean {
  return Array.isArray(value) && value.every((event) => {
    if (!event || typeof event !== "object") return false;
    const item = event as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.name === "string" && item.trigger && typeof item.trigger === "object" && item.effect && typeof item.effect === "object";
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); } catch { /* Storage can be unavailable without breaking the game. */ }
}
