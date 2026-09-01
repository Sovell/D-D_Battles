import type { BattleState } from "../core/domain/types";
import type { ScenarioDraft } from "./scenario-builder-model";

const BATTLE_KEY = "dnd-battles.battle.v1";
const DRAFT_KEY = "dnd-battles.scenario-draft.v1";
const SCREEN_KEY = "dnd-battles.screen.v1";

export type AppScreen = "builder" | "battle";

export interface SavedBattleSession {
  schemaVersion: 1;
  savedAt: string;
  seed: number;
  heroIds: string[];
  state: BattleState;
}

export function loadBattleSession(): SavedBattleSession | null {
  return parseBattleSession(read(BATTLE_KEY));
}

export function saveBattleSession(seed: number, heroIds: string[], state: BattleState): void {
  write(BATTLE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), seed, heroIds, state } satisfies SavedBattleSession));
}

export function parseBattleSession(raw: string | null): SavedBattleSession | null {
  const value = parseObject(raw);
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
  return value as unknown as ScenarioDraft;
}

export function loadLastScreen(): AppScreen {
  return read(SCREEN_KEY) === "battle" && loadBattleSession() ? "battle" : "builder";
}

export function saveLastScreen(screen: AppScreen): void {
  write(SCREEN_KEY, screen);
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
