import { heroClassById, heroClasses } from "../data/heroes";
import type { AbilityScoreId, AbilityScores, DerivedCombatStats, HeroLoadout, HeroProfile, SaveKind } from "../domain/types";
import { itemById } from "../equipment/items";
import { basicAttackForLoadout } from "../equipment/weapon-attacks";
import { raceById, races } from "./hero-progression";
import { abilityModifier, baseAttackBonus } from "./dnd35";

const abilityIds: AbilityScoreId[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const saveAbilities: Record<SaveKind, AbilityScoreId> = { fortitude: "constitution", reflex: "dexterity", will: "wisdom" };

/** The sole calculation path for every combat statistic used by a hero. */
export function deriveCombatStats(profile: HeroProfile, loadout: HeroLoadout): DerivedCombatStats {
  const heroClass = heroClassById.get(profile.classId) ?? heroClasses[0];
  const race = raceById.get(profile.race) ?? races[0];
  const abilityScores = Object.fromEntries(abilityIds.map((id) => [id, heroClass.abilityScores[id] + (race.abilityModifiers[id] ?? 0) + (profile.abilityScoreIncreases?.[id] ?? 0)])) as unknown as AbilityScores;
  const abilityModifiers = Object.fromEntries(abilityIds.map((id) => [id, abilityModifier(abilityScores[id])])) as unknown as AbilityScores;
  const selected = new Set(profile.selectedAbilityIds);
  const talentHp = selected.has("talent-vitality") ? 4 : 0;
  const talentAc = selected.has("talent-resilience") ? 1 : 0;
  const talentAttack = selected.has("talent-accuracy") ? 1 : 0;
  const talentCharges = (selected.has("talent-resourceful-2") ? 1 : 0) + (selected.has("talent-resourceful") ? 1 : 0);
  const bab = baseAttackBonus(heroClass.baseAttackProgression, profile.level);
  const perLevelHp = Math.max(1, Math.round((Math.ceil(heroClass.hitDie / 2) + abilityModifiers.constitution) * 0.5));
  const maxHp = Math.max(1, heroClass.tacticalBaseHp + heroClass.hitDie + abilityModifiers.constitution + (profile.level - 1) * perLevelHp + talentHp);

  const armor = loadout.armor ? itemById.get(loadout.armor)?.armor : undefined;
  const dexterity = Math.min(abilityModifiers.dexterity, armor?.maxDexBonus ?? abilityModifiers.dexterity);
  const shield = loadout.shield ? itemById.get(loadout.shield)?.shieldBonus ?? 0 : 0;
  const equipped = [loadout.cloak, loadout.boots, loadout.belt, loadout.trinket, loadout.ring].flatMap((id) => id ? [itemById.get(id)] : []).filter(Boolean);
  const acGroups = new Map<string, number>();
  for (const definition of equipped) for (const effect of definition!.effects) {
    if (effect.type === "stat" && effect.stat === "defense") acGroups.set(effect.stackingGroup ?? `item:${definition!.id}`, Math.max(acGroups.get(effect.stackingGroup ?? `item:${definition!.id}`) ?? 0, effect.value));
  }
  const naturalArmor = acGroups.get("natural-armor") ?? 0;
  const deflection = acGroups.get("deflection") ?? 0;
  const otherItems = [...acGroups.entries()].filter(([group]) => group !== "natural-armor" && group !== "deflection" && group !== "armor" && group !== "shield").reduce((sum, [, value]) => sum + value, 0);
  const unarmored = !armor && heroClass.unarmoredDefense ? abilityModifiers[heroClass.unarmoredDefense] : 0;
  const other = otherItems + unarmored + talentAc;
  const acBreakdown = { base: 10, dexterity, armor: armor?.armorBonus ?? 0, shield, naturalArmor, deflection, other };
  const defenseClass = Object.values(acBreakdown).reduce((sum, value) => sum + value, 0);

  const saveBreakdown = Object.fromEntries((["fortitude", "reflex", "will"] as SaveKind[]).map((save) => {
    const base = heroClass.saveProgressions[save] === "good" ? 2 + Math.floor(profile.level / 2) : Math.floor(profile.level / 3);
    const equipment = equipped.flatMap((definition) => definition!.effects).reduce((sum, effect) => sum + (effect.type === "save" && (effect.save === "all" || effect.save === save) ? effect.value : 0), 0);
    return [save, { base, ability: abilityModifiers[saveAbilities[save]], equipment }];
  })) as DerivedCombatStats["saveBreakdown"];
  const saves = Object.fromEntries(Object.entries(saveBreakdown).map(([save, parts]) => [save, parts.base + parts.ability + parts.equipment])) as unknown as DerivedCombatStats["saves"];
  const initiative = abilityModifiers.dexterity + heroClass.initiativeBonus;
  const speed = Math.max(1, heroClass.speed - (armor?.speedPenalty ?? 0) + speedBonus(loadout));
  const combatClass = { ...heroClass, abilityScores };
  const basicAttack = basicAttackForLoadout(combatClass, profile.level, loadout, talentAttack);
  return { abilityScores, abilityModifiers, bab, maxHp, defenseClass, acBreakdown, saves, saveBreakdown, initiative, speed, attackBonus: basicAttack.attackBonusOverride ?? bab + talentAttack, basicAttack, maxCharges: heroClass.maxCharges + talentCharges };
}

export function spellSaveDc(profile: HeroProfile, spellRank = 1, abilityOverride?: AbilityScoreId): number {
  const stats = deriveCombatStats(profile, { weapon: null, armor: null, shield: null, cloak: null, boots: null, belt: null, trinket: null, consumables: [] });
  const heroClass = heroClassById.get(profile.classId) ?? heroClasses[0];
  const ability = abilityOverride ?? heroClass.castingAbility;
  return 10 + Math.max(0, spellRank) + (ability ? stats.abilityModifiers[ability] : 0);
}

function speedBonus(loadout: HeroLoadout): number {
  return [loadout.boots, loadout.belt, loadout.trinket].flatMap((id) => id ? [itemById.get(id)] : []).filter(Boolean).flatMap((definition) => definition!.effects).reduce((sum, effect) => sum + (effect.type === "stat" && effect.stat === "speed" ? effect.value : 0), 0);
}
