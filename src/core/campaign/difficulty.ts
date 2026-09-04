import { heroClassById } from "../data/heroes";
import { monsterById } from "../data/monsters";
import type { DifficultyLabel, HeroLoadout, HeroProfile, ItemRarity, ScenarioTemplateId } from "../domain/types";
import { equippedIds } from "../equipment/campaign";
import { itemById } from "../equipment/items";

export interface PowerBreakdown { total: number; parts: Array<{ label: string; value: number }> }

const itemPower: Record<ItemRarity, number> = { common: 1, uncommon: 2, rare: 4, epic: 6 };
const threatByTier = [0, 8, 16, 27, 42, 60];

export function partyPower(heroes: readonly HeroProfile[], loadouts: Record<string, HeroLoadout>): PowerBreakdown {
  const level = heroes.reduce((sum, hero) => sum + 10 + hero.level * 5, 0);
  const classFeatures = heroes.reduce((sum, hero) => sum + (heroClassById.get(hero.classId)?.abilities.length ?? 0) + 2, 0);
  const roleValue = heroes.reduce((sum, hero) => { const weights = heroClassById.get(hero.classId)?.powerWeights; return sum + (weights ? (weights.protection + weights.control + weights.mobility + weights.support) * .25 : 0); }, 0);
  const unlocked = heroes.reduce((sum, hero) => sum + hero.selectedAbilityIds.length * 1.5, 0);
  const equipment = heroes.reduce((sum, hero) => sum + equippedIds(loadouts[hero.id] ?? { weapon: null, armor: null, shield: null, cloak: null, boots: null, belt: null, trinket: null, consumables: [null, null, null] }).reduce((itemSum, id) => itemSum + itemPower[itemById.get(id)?.rarity ?? "common"], 0), 0);
  const incomplete = heroes.length < 4 ? (heroes.length === 3 ? -4 : -12) : 0;
  const total = Math.max(1, Math.round((level + classFeatures + roleValue + unlocked + equipment + incomplete) * 10) / 10);
  return { total, parts: [{ label: `${heroes.length} bohaterów i poziomy`, value: level }, { label: "Zdolności klasowe", value: classFeatures }, { label: "Ochrona, kontrola, mobilność i wsparcie", value: Math.round(roleValue * 10) / 10 }, { label: "Odblokowane zdolności", value: unlocked }, { label: "Wyposażenie", value: equipment }, ...(incomplete ? [{ label: "Niepełny skład", value: incomplete }] : [])] };
}

export function monsterThreatRating(monsterId: string): number {
  const monster = monsterById.get(monsterId);
  if (!monster) return 0;
  return monster.threatRating ?? threatByTier[monster.tier] * (monster.doctrine === "boss" ? 1.35 : monster.traits.some((trait) => /elite/i.test(trait)) ? 1.15 : 1);
}

export function encounterPower(monsterIds: readonly string[], objectiveType: ScenarioTemplateId = "skirmish", defenderAdvantage = 0): PowerBreakdown {
  const base = monsterIds.reduce((sum, id) => sum + monsterThreatRating(id), 0);
  const roles = new Set(monsterIds.map((id) => monsterById.get(id)?.doctrine).filter(Boolean));
  const synergy = roles.size >= 3 ? 1.1 : roles.size >= 2 ? 1.05 : 1;
  const objectiveModifiers: Partial<Record<ScenarioTemplateId, number>> = { "hold-the-line": 1.1, breakthrough: 1.05, assassinate: 1.08, rescue: 1.05, "ritual-disruption": 1.1, escape: 1.08, "treasure-run": 1.12 };
  const objective = objectiveModifiers[objectiveType] ?? 1;
  const defense = 1 + Math.max(0, Math.min(.25, defenderAdvantage));
  const total = Math.round(base * synergy * objective * defense * 10) / 10;
  return { total, parts: [{ label: "Zagrożenie potworów", value: Math.round(base * 10) / 10 }, { label: `Synergia ról ×${synergy.toFixed(2)}`, value: Math.round(base * (synergy - 1) * 10) / 10 }, { label: `Cel ×${objective.toFixed(2)}`, value: Math.round(base * synergy * (objective - 1) * 10) / 10 }, ...(defenderAdvantage ? [{ label: `Przewaga obrony ×${defense.toFixed(2)}`, value: Math.round(base * synergy * objective * (defense - 1) * 10) / 10 }] : [])] };
}

export function difficultyForRatio(ratio: number): DifficultyLabel {
  if (ratio < .65) return "Trivial";
  if (ratio < .9) return "Easy";
  if (ratio < 1.15) return "Standard";
  if (ratio < 1.4) return "Hard";
  if (ratio < 1.7) return "Deadly";
  return "Overwhelming";
}

export function assessDifficulty(heroes: readonly HeroProfile[], loadouts: Record<string, HeroLoadout>, monsterIds: readonly string[], objectiveType: ScenarioTemplateId = "skirmish", defenderAdvantage = 0) {
  const party = partyPower(heroes, loadouts);
  const encounter = encounterPower(monsterIds, objectiveType, defenderAdvantage);
  const ratio = Math.round(encounter.total / party.total * 100) / 100;
  return { party, encounter, ratio, label: difficultyForRatio(ratio) };
}
