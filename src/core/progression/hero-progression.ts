import { heroClassById, heroClasses } from "../data/heroes";
import type { AbilityDefinition, AbilityScoreId, AbilityScores, HeroClassDefinition, HeroProfile, Id, RaceId } from "../domain/types";

export const MAX_HERO_LEVEL = 5;
export const XP_THRESHOLDS = [0, 100, 250, 450, 700] as const;
export const PROGRESSION_CHOICE_LEVELS = [2, 3, 5] as const;

export interface RaceDefinition {
  id: RaceId;
  name: string;
  description: string;
  abilityModifiers: Partial<Record<AbilityScoreId, number>>;
}

export interface ProgressionOption {
  id: Id;
  level: 2 | 3 | 5;
  name: string;
  description: string;
  kind: "ability" | "talent";
  modifiers?: { maxHp?: number; defenseClass?: number; attackBonus?: number; maxCharges?: number };
}

export const races: RaceDefinition[] = [
  { id: "human", name: "Human", description: "Brak modyfikatorów cech.", abilityModifiers: {} },
  { id: "dwarf", name: "Dwarf", description: "+2 Kondycji, −2 Charyzmy.", abilityModifiers: { constitution: 2, charisma: -2 } },
  { id: "elf", name: "Elf", description: "+2 Zręczności, −2 Kondycji.", abilityModifiers: { dexterity: 2, constitution: -2 } },
  { id: "halfling", name: "Halfling", description: "+2 Zręczności, −2 Siły.", abilityModifiers: { dexterity: 2, strength: -2 } },
  { id: "half-elf", name: "Half-Elf", description: "Brak modyfikatorów cech.", abilityModifiers: {} },
  { id: "half-orc", name: "Half-Orc", description: "+2 Siły, −2 Inteligencji, −2 Charyzmy.", abilityModifiers: { strength: 2, intelligence: -2, charisma: -2 } },
];

export const raceById = new Map(races.map((race) => [race.id, race]));
const heroicFocus: AbilityDefinition = { id: "heroic-focus", name: "Heroic Focus", description: "+2 Obrony do następnej aktywacji.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "guarded" };

export function createHeroProfile(input: { id?: string; name: string; race: RaceId; classId: string; portraitVariant?: number }): HeroProfile {
  const heroClass = heroClassById.get(input.classId);
  if (!heroClass) throw new Error("Unknown hero class");
  if (!raceById.has(input.race)) throw new Error("Unknown hero race");
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Hero name must contain at least two characters");
  return {
    id: input.id ?? createProfileId(name),
    name,
    race: input.race,
    classId: input.classId,
    level: 1,
    xp: 0,
    selectedAbilityIds: heroClass.abilities.slice(0, 3).map((ability) => ability.id),
    portraitVariant: boundedPortrait(input.portraitVariant ?? 0),
    abilityScoreIncreases: {},
  };
}

export function createLegacyHeroProfile(classId: string, portraitVariant = 0): HeroProfile {
  const heroClass = heroClassById.get(classId);
  if (!heroClass) throw new Error(`Unknown legacy hero class: ${classId}`);
  return {
    id: classId,
    name: heroClass.name,
    race: "human",
    classId,
    level: 1,
    xp: 0,
    selectedAbilityIds: heroClass.abilities.map((ability) => ability.id),
    portraitVariant: boundedPortrait(portraitVariant),
    abilityScoreIncreases: {},
  };
}

export function createLegacyRoster(): HeroProfile[] {
  return ["fighter", "rogue", "cleric", "wizard"].map((classId) => createLegacyHeroProfile(classId));
}

export function createStarterRoster(): HeroProfile[] {
  const names: Record<string, string> = { barbarian: "Kara", bard: "Lio", druid: "Mira", monk: "Shen", paladin: "Aldric", ranger: "Sylva", sorcerer: "Veyra" };
  const newcomers = heroClasses.slice(4).map((heroClass, index) => createHeroProfile({ id: `example-${heroClass.id}`, name: names[heroClass.id] ?? heroClass.name, race: races[index % races.length].id, classId: heroClass.id }));
  return [...createLegacyRoster(), ...newcomers];
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let index = 1; index < XP_THRESHOLDS.length; index += 1) if (safeXp >= XP_THRESHOLDS[index]) level = index + 1;
  return Math.min(MAX_HERO_LEVEL, level);
}

export function awardXp(profile: HeroProfile, amount: number): HeroProfile {
  const xp = Math.max(0, Math.floor(profile.xp + Math.max(0, amount)));
  return { ...profile, xp, level: levelForXp(xp), selectedAbilityIds: [...profile.selectedAbilityIds], abilityScoreIncreases: { ...(profile.abilityScoreIncreases ?? {}) } };
}

export function pendingAbilityScoreIncreases(profile: HeroProfile): number {
  const earned = Math.floor(profile.level / 4);
  const spent = Object.values(profile.abilityScoreIncreases ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
  return Math.max(0, earned - spent);
}

export function increaseAbilityScore(profile: HeroProfile, ability: AbilityScoreId): HeroProfile {
  if (pendingAbilityScoreIncreases(profile) <= 0) return profile;
  const current = profile.abilityScoreIncreases ?? {};
  return { ...profile, abilityScoreIncreases: { ...current, [ability]: (current[ability] ?? 0) + 1 } };
}

export function progressionOptions(classId: string, level: 2 | 3 | 5): ProgressionOption[] {
  const heroClass = heroClassById.get(classId);
  if (!heroClass) return [];
  if (level === 2) return [
    { id: "talent-vitality", level: 2, name: "Vitality", description: "+4 maksymalnych punktów życia.", kind: "talent", modifiers: { maxHp: 4 } },
    { id: "talent-resourceful-2", level: 2, name: "Resourceful", description: "+1 ładunek zdolności w każdej bitwie.", kind: "talent", modifiers: { maxCharges: 1 } },
  ];
  if (level === 3) return [
    abilityOption(heroClass, 3, 3),
    { id: "talent-accuracy", level: 3, name: "Combat Accuracy", description: "+1 do ataku.", kind: "talent", modifiers: { attackBonus: 1 } },
  ].filter(Boolean) as ProgressionOption[];
  return [
    abilityOption(heroClass, 4, 5),
    { id: heroicFocus.id, level: 5, name: heroicFocus.name, description: heroicFocus.description, kind: "ability" },
    { id: "talent-resilience", level: 5, name: "Battle Resilience", description: "+1 Obrony.", kind: "talent", modifiers: { defenseClass: 1 } },
    { id: "talent-resourceful", level: 5, name: "Resourceful", description: "+1 ładunek zdolności w każdej bitwie.", kind: "talent", modifiers: { maxCharges: 1 } },
  ].filter(Boolean) as ProgressionOption[];
}

export function pendingProgressionLevels(profile: HeroProfile): Array<2 | 3 | 5> {
  return PROGRESSION_CHOICE_LEVELS.filter((level) => profile.level >= level && !progressionOptions(profile.classId, level).some((option) => profile.selectedAbilityIds.includes(option.id)));
}

export function chooseProgressionOption(profile: HeroProfile, optionId: string): HeroProfile {
  const level = pendingProgressionLevels(profile).find((candidate) => progressionOptions(profile.classId, candidate).some((option) => option.id === optionId));
  if (!level) return profile;
  return { ...profile, selectedAbilityIds: [...profile.selectedAbilityIds, optionId] };
}

export function validateParty(profiles: readonly HeroProfile[], selectedProfileIds: readonly string[]): string[] {
  const errors: string[] = [];
  if (selectedProfileIds.length < 3 || selectedProfileIds.length > 4) errors.push("Drużyna musi mieć 3–4 bohaterów.");
  if (new Set(selectedProfileIds).size !== selectedProfileIds.length) errors.push("Nie można wybrać tego samego bohatera dwa razy.");
  if (selectedProfileIds.some((id) => !profiles.some((profile) => profile.id === id))) errors.push("Drużyna zawiera nieznany profil bohatera.");
  return errors;
}

export function heroBattleStats(profile: HeroProfile): HeroClassDefinition & { maxCharges: number } {
  const heroClass = heroClassById.get(profile.classId) ?? heroClasses[0];
  const race = raceById.get(profile.race) ?? races[0];
  const selectedOptions = PROGRESSION_CHOICE_LEVELS.flatMap((level) => progressionOptions(profile.classId, level)).filter((option) => profile.selectedAbilityIds.includes(option.id));
  const maxChargeBonus = selectedOptions.reduce((sum, option) => sum + (option.modifiers?.maxCharges ?? 0), 0);
  const abilityScores = Object.fromEntries(Object.entries(heroClass.abilityScores).map(([ability, score]) => [ability, score + (race.abilityModifiers[ability as AbilityScoreId] ?? 0) + (profile.abilityScoreIncreases?.[ability as AbilityScoreId] ?? 0)])) as unknown as AbilityScores;
  return {
    ...heroClass,
    abilityScores,
    maxCharges: heroClass.maxCharges + maxChargeBonus,
    abilities: [...heroClass.abilities.filter((ability, index) => index < 3 || profile.selectedAbilityIds.includes(ability.id)), ...(profile.selectedAbilityIds.includes(heroicFocus.id) ? [heroicFocus] : [])],
  };
}

export function scenarioVictoryXp(rewardXp: number | undefined): number { return Math.max(0, Math.floor(rewardXp ?? 100)); }

export function awardVictoryXp(profiles: readonly HeroProfile[], participatingProfileIds: readonly string[], rewardXp: number | undefined): HeroProfile[] {
  const participants = new Set(participatingProfileIds);
  const reward = scenarioVictoryXp(rewardXp);
  return profiles.map((profile) => participants.has(profile.id) ? awardXp(profile, reward) : { ...profile, selectedAbilityIds: [...profile.selectedAbilityIds], abilityScoreIncreases: { ...(profile.abilityScoreIncreases ?? {}) } });
}

function abilityOption(heroClass: HeroClassDefinition, index: number, level: 2 | 3 | 5): ProgressionOption | undefined {
  const ability = heroClass.abilities[index];
  return ability ? { id: ability.id, level, name: ability.name, description: ability.description, kind: "ability" } : undefined;
}
function createProfileId(name: string): string { return `hero-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "adventurer"}-${Date.now().toString(36)}`; }
function boundedPortrait(value: number): number { return Math.max(0, Math.min(99, Math.floor(value))); }
