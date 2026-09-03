import type { BattleState, HeroProfile, RaceId } from "../core/domain/types";
import { createLegacyHeroProfile, createLegacyRoster, levelForXp, raceById } from "../core/progression/hero-progression";
import { availableHeroIds, createDefaultScenarioDraft, selectScenarioPreset, type ScenarioDraft, type SupportedScenarioPresetId } from "./scenario-builder-model";

const BATTLE_KEY = "dnd-battles.battle.v1";
const BATTLE_SAVES_KEY = "dnd-battles.manual-saves.v1";
const DRAFT_KEY = "dnd-battles.scenario-draft.v1";
const HERO_PROFILES_KEY = "dnd-battles.hero-profiles.v1";

export type AppScreen = "menu" | "builder" | "battle";

export interface SavedBattleSession {
  schemaVersion: 2;
  savedAt: string;
  seed: number;
  heroSnapshots: HeroProfile[];
  state: BattleState;
}

export interface HeroProfileCollection { schemaVersion: 1; profiles: HeroProfile[] }

export interface NamedBattleSave extends SavedBattleSession {
  id: string;
  name: string;
}

export function loadBattleSession(): SavedBattleSession | null {
  return parseBattleSession(read(BATTLE_KEY));
}

export function saveBattleSession(seed: number, heroSnapshots: HeroProfile[], state: BattleState): void {
  write(BATTLE_KEY, JSON.stringify({ schemaVersion: 2, savedAt: new Date().toISOString(), seed, heroSnapshots, state } satisfies SavedBattleSession));
}

export function parseBattleSession(raw: string | null): SavedBattleSession | null {
  const value = parseObject(raw);
  return parseBattleSessionValue(value);
}

export function createManualBattleSave(seed: number, heroSnapshots: HeroProfile[], state: BattleState): NamedBattleSave {
  const savedAt = new Date().toISOString();
  const save: NamedBattleSave = {
    schemaVersion: 2,
    id: `battle-${Date.now()}`,
    name: `${state.scenario.name} · runda ${state.round}`,
    savedAt,
    seed,
    heroSnapshots: structuredClone(heroSnapshots),
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
  if (!value || ![1, 2].includes(Number(value.schemaVersion)) || typeof value.savedAt !== "string" || !Number.isInteger(value.seed) || !isBattleState(value.state)) return null;
  const state = value.state as BattleState;
  let heroSnapshots: HeroProfile[] | null = null;
  if (value.schemaVersion === 2) heroSnapshots = parseHeroProfileArray(value.heroSnapshots);
  if (value.schemaVersion === 1 && isStringArray(value.heroIds)) {
    heroSnapshots = value.heroIds.flatMap((classId) => {
      try {
        const unit = state.combatants.find((candidate) => candidate.side === "heroes" && candidate.definitionId === classId);
        return [{ ...createLegacyHeroProfile(classId, unit?.artVariant ?? 0), name: unit?.name ?? classId }];
      } catch { return []; }
    });
  }
  if (!heroSnapshots?.length) return null;
  return { schemaVersion: 2, savedAt: value.savedAt, seed: Number(value.seed), heroSnapshots, state: { ...state, heroSnapshots: structuredClone(heroSnapshots), progressionRewardClaimed: state.progressionRewardClaimed ?? false } };
}

export function loadHeroProfiles(): HeroProfile[] {
  return parseHeroProfileCollection(read(HERO_PROFILES_KEY))?.profiles ?? createLegacyRoster();
}

export function saveHeroProfiles(profiles: HeroProfile[]): void {
  write(HERO_PROFILES_KEY, JSON.stringify({ schemaVersion: 1, profiles } satisfies HeroProfileCollection));
}

export function parseHeroProfileCollection(raw: string | null): HeroProfileCollection | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) {
      const profiles = migrateLegacyProfileArray(value);
      return profiles.length ? { schemaVersion: 1, profiles } : null;
    }
    if (!value || typeof value !== "object") return null;
    const collection = value as Record<string, unknown>;
    if (collection.schemaVersion === 1) {
      const profiles = parseHeroProfileArray(collection.profiles);
      return profiles ? { schemaVersion: 1, profiles } : null;
    }
    if (collection.schemaVersion === undefined && Array.isArray(collection.profiles)) {
      const profiles = migrateLegacyProfileArray(collection.profiles);
      return profiles.length ? { schemaVersion: 1, profiles } : null;
    }
    return null;
  } catch { return null; }
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
  if (typeof value.name !== "string" || !Number.isInteger(value.seed) || !isStringArray(value.monsterIds)) return null;
  if (!isStringArray(value.heroProfileIds) && !isStringArray(value.heroIds)) return null;
  const presetId = value.presetId as SupportedScenarioPresetId;
  const migrated = selectScenarioPreset(createDefaultScenarioDraft(Number(value.seed)), presetId);
  const heroProfileIds = isStringArray(value.heroProfileIds) ? value.heroProfileIds : value.heroIds as string[];
  const mapEnvironment = ["dungeon", "outdoor", "interior"].includes(String(value.mapEnvironment)) ? value.mapEnvironment as ScenarioDraft["mapEnvironment"] : migrated.mapEnvironment;
  const map = isDungeonMap(value.map) ? value.map as ScenarioDraft["map"] : migrated.map;
  const events = isScenarioEventList(value.events) ? value.events as ScenarioDraft["events"] : migrated.events;
  return { ...migrated, ...value, presetId, heroProfileIds, mapEnvironment, map, events } as ScenarioDraft;
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

function parseHeroProfileArray(value: unknown): HeroProfile[] | null {
  if (!Array.isArray(value)) return null;
  const profiles = value.map(parseHeroProfile);
  if (profiles.some((profile) => !profile)) return null;
  const valid = profiles as HeroProfile[];
  return new Set(valid.map((profile) => profile.id)).size === valid.length ? valid : null;
}

function parseHeroProfile(value: unknown): HeroProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  if (typeof profile.id !== "string" || !profile.id || typeof profile.name !== "string" || profile.name.trim().length < 2) return null;
  if (typeof profile.classId !== "string" || !availableHeroIds.includes(profile.classId) || !raceById.has(profile.race as RaceId)) return null;
  if (!Number.isInteger(profile.xp) || Number(profile.xp) < 0 || !Number.isInteger(profile.level) || !isStringArray(profile.selectedAbilityIds)) return null;
  if (!Number.isInteger(profile.portraitVariant) || Number(profile.portraitVariant) < 0 || Number(profile.portraitVariant) > 2) return null;
  const xp = Math.max(0, Math.floor(Number(profile.xp)));
  return { id: profile.id, name: profile.name.trim(), race: profile.race as RaceId, classId: profile.classId, level: levelForXp(xp), xp, selectedAbilityIds: [...new Set(profile.selectedAbilityIds)], portraitVariant: Number(profile.portraitVariant) };
}

function migrateLegacyProfileArray(values: unknown[]): HeroProfile[] {
  const migrated = values.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const legacy = value as Record<string, unknown>;
    const classId = typeof legacy.classId === "string" ? legacy.classId : typeof legacy.heroClassId === "string" ? legacy.heroClassId : "";
    if (!availableHeroIds.includes(classId)) return [];
    try {
      const base = createLegacyHeroProfile(classId, Number.isInteger(legacy.portraitVariant) ? Number(legacy.portraitVariant) : 0);
      const xp = Number.isInteger(legacy.xp) ? Math.max(0, Number(legacy.xp)) : 0;
      return [{ ...base, id: typeof legacy.id === "string" ? legacy.id : `${classId}-${index + 1}`, name: typeof legacy.name === "string" && legacy.name.trim().length >= 2 ? legacy.name.trim() : base.name, race: raceById.has(legacy.race as RaceId) ? legacy.race as RaceId : "human", xp, level: levelForXp(xp), selectedAbilityIds: isStringArray(legacy.selectedAbilityIds) ? [...new Set(legacy.selectedAbilityIds)] : base.selectedAbilityIds }];
    } catch { return []; }
  });
  return migrated.filter((profile, index) => migrated.findIndex((candidate) => candidate.id === profile.id) === index);
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
