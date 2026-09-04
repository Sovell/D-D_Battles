import type { HeroClassDefinition } from "../domain/types";

export function abilityModifier(score: number): number { return Math.floor((score - 10) / 2); }

export function baseAttackBonus(progression: HeroClassDefinition["baseAttackProgression"], level: number): number {
  const boundedLevel = Math.max(1, Math.floor(level));
  if (progression === "good") return boundedLevel;
  if (progression === "average") return Math.floor(boundedLevel * 0.75);
  return Math.floor(boundedLevel * 0.5);
}
