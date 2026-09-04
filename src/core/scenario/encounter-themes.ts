import type { EncounterTheme, EncounterThemeId, ScenarioTemplateId } from "../domain/types";
import { monsterById } from "../data/monsters";
import { createRandom } from "../random/random";
import { monsterThreatRating } from "../campaign/difficulty";

export const encounterThemes: EncounterTheme[] = [
  { id: "goblin-raid", name: "Goblin Raid", allowedMonsterIds: ["goblin", "bugbear-ambusher", "worg", "hobgoblin-captain"], preferredRoles: ["skirmisher", "guardian"], biomes: ["ruins", "cave"], objectiveTypes: ["skirmish", "hold-the-line", "breakthrough", "assassinate"], rewardTable: { preferredTags: ["utility", "weapon"] }, bossId: "hobgoblin-captain" },
  { id: "undead-crypt", name: "Undead Crypt", allowedMonsterIds: ["skeleton", "zombie", "ghoul", "wraith"], preferredRoles: ["guardian", "controller"], biomes: ["crypt"], objectiveTypes: ["skirmish", "ritual-disruption", "treasure-run"], rewardTable: { preferredTags: ["radiant", "defense"] }, bossId: "wraith" },
  { id: "beast-hunt", name: "Beast Hunt", allowedMonsterIds: ["giant-spider", "dire-wolf", "owlbear", "manticore"], preferredRoles: ["skirmisher", "brute"], biomes: ["cave", "ruins"], objectiveTypes: ["skirmish", "assassinate", "rescue"], rewardTable: { preferredTags: ["movement", "healing"] }, bossId: "manticore" },
  { id: "orc-warband", name: "Orc Warband", allowedMonsterIds: ["orc-brute", "worg", "hobgoblin-captain", "minotaur"], preferredRoles: ["brute", "guardian"], biomes: ["ruins", "cave"], objectiveTypes: ["skirmish", "hold-the-line", "breakthrough"], rewardTable: { preferredTags: ["weapon", "defense"] }, bossId: "minotaur" },
  { id: "fiendish-ritual", name: "Fiendish Ritual", allowedMonsterIds: ["ritualist", "harpy", "wraith"], preferredRoles: ["controller", "ranged"], biomes: ["crypt", "ruins"], objectiveTypes: ["ritual-disruption", "assassinate"], rewardTable: { preferredTags: ["arcane", "saves"] }, bossId: "ritualist" },
  { id: "dragons-lair", name: "Dragon’s Lair", allowedMonsterIds: ["goblin", "hobgoblin-captain", "manticore", "young-dragon"], preferredRoles: ["guardian", "boss"], biomes: ["cave", "ruins"], objectiveTypes: ["treasure-run", "assassinate", "escape"], rewardTable: { preferredTags: ["fire", "defense"], uniqueItemId: "flaming-weapon" }, bossId: "young-dragon" },
];
export const encounterThemeById = new Map(encounterThemes.map((theme) => [theme.id, theme]));

export function generateThemedEncounter(themeId: EncounterThemeId, budget: number, seed: number, includeBoss = false): string[] {
  const theme = encounterThemeById.get(themeId);
  if (!theme) return [];
  const random = createRandom(seed);
  const allowed = theme.allowedMonsterIds.filter((id) => monsterById.has(id));
  const result: string[] = [];
  let remaining = Math.max(1, budget);
  if (includeBoss && theme.bossId && monsterThreatRating(theme.bossId) <= remaining) { result.push(theme.bossId); remaining -= monsterThreatRating(theme.bossId); }
  const candidates = allowed.filter((id) => id !== theme.bossId || includeBoss).sort((a, b) => monsterThreatRating(b) - monsterThreatRating(a));
  while (candidates.length && result.length < 12) {
    const affordable = candidates.filter((id) => monsterThreatRating(id) <= remaining);
    if (!affordable.length) break;
    const preferred = affordable.filter((id) => theme.preferredRoles.includes(monsterById.get(id)!.doctrine));
    const pool = preferred.length && random.next() < .65 ? preferred : affordable;
    const picked = pool[random.int(0, pool.length - 1)];
    result.push(picked); remaining -= monsterThreatRating(picked);
  }
  if (!result.length && allowed.length) result.push([...allowed].sort((a, b) => monsterThreatRating(a) - monsterThreatRating(b))[0]);
  return result;
}

export function themeSupportsRoster(themeId: EncounterThemeId, roster: readonly string[]): boolean {
  const allowed = new Set(encounterThemeById.get(themeId)?.allowedMonsterIds ?? []);
  return roster.length > 0 && roster.every((id) => allowed.has(id));
}
