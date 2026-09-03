import { heroClassById, heroClasses } from "../data/heroes";
import type { AbilityDefinition, HeroClassDefinition, HeroProfile, Id, RaceId } from "../domain/types";

export const MAX_HERO_LEVEL = 5;
export const XP_THRESHOLDS = [0, 100, 250, 450, 700] as const;
export const PROGRESSION_CHOICE_LEVELS = [2, 3, 5] as const;

export interface RaceDefinition {
  id: RaceId;
  name: string;
  description: string;
  bonuses: { maxHp?: number; defenseClass?: number; initiative?: number; maxCharges?: number };
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
  { id: "human", name: "Human", description: "+1 ładunek zdolności w każdej bitwie.", bonuses: { maxCharges: 1 } },
  { id: "dwarf", name: "Dwarf", description: "+2 maksymalnych punktów życia.", bonuses: { maxHp: 2 } },
  { id: "elf", name: "Elf", description: "+1 do inicjatywy.", bonuses: { initiative: 1 } },
  { id: "halfling", name: "Halfling", description: "+1 Obrony.", bonuses: { defenseClass: 1 } },
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
    selectedAbilityIds: [heroClass.abilities[0]?.id].filter((id): id is string => Boolean(id)),
    portraitVariant: boundedPortrait(input.portraitVariant ?? 0),
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
  };
}

export function createLegacyRoster(): HeroProfile[] {
  return heroClasses.map((heroClass) => createLegacyHeroProfile(heroClass.id));
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let index = 1; index < XP_THRESHOLDS.length; index += 1) if (safeXp >= XP_THRESHOLDS[index]) level = index + 1;
  return Math.min(MAX_HERO_LEVEL, level);
}

export function awardXp(profile: HeroProfile, amount: number): HeroProfile {
  const xp = Math.max(0, Math.floor(profile.xp + Math.max(0, amount)));
  return { ...profile, xp, level: levelForXp(xp), selectedAbilityIds: [...profile.selectedAbilityIds] };
}

export function progressionOptions(classId: string, level: 2 | 3 | 5): ProgressionOption[] {
  const heroClass = heroClassById.get(classId);
  if (!heroClass) return [];
  if (level === 2) return [
    abilityOption(heroClass, 1, 2),
    { id: "talent-vitality", level: 2, name: "Vitality", description: "+4 maksymalnych punktów życia.", kind: "talent", modifiers: { maxHp: 4 } },
  ].filter(Boolean) as ProgressionOption[];
  if (level === 3) return [
    abilityOption(heroClass, 2, 3),
    { id: "talent-accuracy", level: 3, name: "Combat Accuracy", description: "+1 do ataku.", kind: "talent", modifiers: { attackBonus: 1 } },
  ].filter(Boolean) as ProgressionOption[];
  return [
    { id: heroicFocus.id, level: 5, name: heroicFocus.name, description: heroicFocus.description, kind: "ability" },
    { id: "talent-resilience", level: 5, name: "Battle Resilience", description: "+1 Obrony.", kind: "talent", modifiers: { defenseClass: 1 } },
    { id: "talent-resourceful", level: 5, name: "Resourceful", description: "+1 ładunek zdolności w każdej bitwie.", kind: "talent", modifiers: { maxCharges: 1 } },
  ];
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
  const heroClass = heroClassById.get(profile.classId);
  if (!heroClass) throw new Error(`Unknown hero class: ${profile.classId}`);
  const race = raceById.get(profile.race);
  if (!race) throw new Error(`Unknown hero race: ${profile.race}`);
  const selectedOptions = PROGRESSION_CHOICE_LEVELS.flatMap((level) => progressionOptions(profile.classId, level)).filter((option) => profile.selectedAbilityIds.includes(option.id));
  const modifiers = selectedOptions.reduce((sum, option) => ({
    maxHp: sum.maxHp + (option.modifiers?.maxHp ?? 0),
    defenseClass: sum.defenseClass + (option.modifiers?.defenseClass ?? 0),
    attackBonus: sum.attackBonus + (option.modifiers?.attackBonus ?? 0),
    maxCharges: sum.maxCharges + (option.modifiers?.maxCharges ?? 0),
  }), { maxHp: 0, defenseClass: 0, attackBonus: 0, maxCharges: 0 });
  const levelHp = (profile.level - 1) * 2;
  const levelAttack = profile.level >= 5 ? 2 : profile.level >= 3 ? 1 : 0;
  return {
    ...heroClass,
    maxHp: heroClass.maxHp + levelHp + (race.bonuses.maxHp ?? 0) + modifiers.maxHp,
    defenseClass: heroClass.defenseClass + (race.bonuses.defenseClass ?? 0) + modifiers.defenseClass,
    initiative: heroClass.initiative + (race.bonuses.initiative ?? 0),
    attackBonus: heroClass.attackBonus + levelAttack + modifiers.attackBonus,
    maxCharges: heroClass.maxCharges + (race.bonuses.maxCharges ?? 0) + modifiers.maxCharges,
    abilities: [...heroClass.abilities.filter((ability, index) => index === 0 || profile.selectedAbilityIds.includes(ability.id)), ...(profile.selectedAbilityIds.includes(heroicFocus.id) ? [heroicFocus] : [])],
  };
}

export function scenarioVictoryXp(rewardXp: number | undefined): number { return Math.max(0, Math.floor(rewardXp ?? 100)); }

export function awardVictoryXp(profiles: readonly HeroProfile[], participatingProfileIds: readonly string[], rewardXp: number | undefined): HeroProfile[] {
  const participants = new Set(participatingProfileIds);
  const reward = scenarioVictoryXp(rewardXp);
  return profiles.map((profile) => participants.has(profile.id) ? awardXp(profile, reward) : { ...profile, selectedAbilityIds: [...profile.selectedAbilityIds] });
}

function abilityOption(heroClass: HeroClassDefinition, index: number, level: 2 | 3): ProgressionOption | undefined {
  const ability = heroClass.abilities[index];
  return ability ? { id: ability.id, level, name: ability.name, description: ability.description, kind: "ability" } : undefined;
}
function createProfileId(name: string): string { return `hero-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "adventurer"}-${Date.now().toString(36)}`; }
function boundedPortrait(value: number): number { return Math.max(0, Math.min(2, Math.floor(value))); }
