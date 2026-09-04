import { meleeAttack } from "../data/abilities";
import { heroClassById } from "../data/heroes";
import type { AbilityDefinition, HeroClassDefinition, HeroLoadout, ItemDefinition } from "../domain/types";
import { abilityModifier, baseAttackBonus } from "../progression/dnd35";
import { itemById } from "./items";

const spellcastingClasses = new Set(["wizard", "sorcerer"]);
const unarmedStrike = meleeAttack("unarmed-strike", "Unarmed Strike", { count: 1, sides: 4 }, "bludgeoning");

export function basicAttackForLoadout(hero: HeroClassDefinition, level: number, loadout: HeroLoadout, equipmentAttackBonus = 0): AbilityDefinition {
  if (spellcastingClasses.has(hero.id)) return hero.basicAttack;
  const weapon = loadout.weapon ? itemById.get(loadout.weapon) : undefined;
  if (weapon?.weaponAttack) return weaponAttackForHero(hero, level, weapon, equipmentAttackBonus);
  if (hero.id === "monk") return unarmedAttackForHero(hero, level, hero.basicAttack);
  return unarmedAttackForHero(hero, level, unarmedStrike);
}

export function weaponSwitchAbility(classId: string, loadout: HeroLoadout): AbilityDefinition | undefined {
  if (spellcastingClasses.has(classId)) return undefined;
  const backup = loadout.backupWeapon ? itemById.get(loadout.backupWeapon) : undefined;
  if (!backup?.weaponAttack || (backup.tags.includes("two-handed") && loadout.shield)) return undefined;
  return { id: "switch-weapon", name: `Dobycie: ${backup.name}`, description: `Zamień broń główną z zapasową (${backup.name}). Zużywa akcję tej tury.`, range: 0, resourceCost: 0, target: "self", kind: "status", special: "switch-weapon" };
}

function weaponAttackForHero(hero: HeroClassDefinition, level: number, weapon: ItemDefinition, equipmentAttackBonus: number): AbilityDefinition {
  const baseClass = heroClassById.get(hero.id) ?? hero;
  const babGrowth = baseAttackBonus(hero.baseAttackProgression, level) - baseAttackBonus(hero.baseAttackProgression, 1);
  const generalAttackAdjustment = hero.attackBonus - baseClass.attackBonus - babGrowth;
  const attackAbility = weaponAttackAbility(hero, weapon);
  const attackAbilityBonus = abilityModifier(hero.abilityScores[attackAbility]);
  const damageAbilityBonus = weaponDamageAbilityBonus(hero, weapon);
  const proficient = isWeaponProficient(hero, weapon);
  const nonProficiencyPenalty = proficient ? 0 : -4;
  const enhancement = weapon.effects.reduce((sum, effect) => sum + (effect.type === "stat" && effect.stat === "attack" ? effect.value : 0), 0);
  const attackBonus = baseAttackBonus(hero.baseAttackProgression, level) + attackAbilityBonus + generalAttackAdjustment + equipmentAttackBonus + nonProficiencyPenalty;
  const attack = structuredClone(weapon.weaponAttack!);
  const damage = { ...(attack.damage ?? { count: 1, sides: 4 }), bonus: damageAbilityBonus + enhancement };
  const abilityLabel = attackAbility === "strength" ? "Siła" : "Zręczność";
  return { ...attack, damage, attackBonusOverride: attackBonus, tags: [...(attack.tags ?? []), "weapon-attack", proficient ? "proficient" : "not-proficient"], description: `${damage.count}k${damage.sides}${signed(damage.bonus ?? 0)} obrażeń · trafienie ${signed(attackBonus)} (BAB ${signed(baseAttackBonus(hero.baseAttackProgression, level))}, ${abilityLabel} ${signed(attackAbilityBonus)}${proficient ? "" : ", kara −4 za brak biegłości"}).` };
}

export function isWeaponProficient(hero: HeroClassDefinition, weapon: ItemDefinition): boolean {
  return hero.weaponProficiencies.includes(weapon.id) || hero.weaponProficiencies.some((entry) => weapon.tags.includes(entry));
}

function unarmedAttackForHero(hero: HeroClassDefinition, level: number, attack: AbilityDefinition): AbilityDefinition {
  const abilityName = hero.id === "monk" ? "dexterity" : "strength";
  const abilityBonus = abilityModifier(hero.abilityScores[abilityName]);
  const strengthDamage = abilityModifier(hero.abilityScores.strength);
  const attackBonus = baseAttackBonus(hero.baseAttackProgression, level) + abilityBonus;
  const damage = { ...(attack.damage ?? { count: 1, sides: 4 }), bonus: strengthDamage };
  return { ...attack, damage, attackBonusOverride: attackBonus, tags: [...(attack.tags ?? []), "weapon-attack", "proficient"], description: `${damage.count}k${damage.sides}${signed(damage.bonus ?? 0)} obrażeń · trafienie ${signed(attackBonus)}.` };
}

function weaponAttackAbility(hero: HeroClassDefinition, weapon: ItemDefinition): "strength" | "dexterity" {
  if (weapon.tags.includes("ranged") || weapon.tags.includes("thrown")) return "dexterity";
  if (hero.weaponFinesse && weapon.tags.includes("finesse") && abilityModifier(hero.abilityScores.dexterity) > abilityModifier(hero.abilityScores.strength)) return "dexterity";
  return "strength";
}

function weaponDamageAbilityBonus(hero: HeroClassDefinition, weapon: ItemDefinition): number {
  if (weapon.tags.includes("thrown")) return abilityModifier(hero.abilityScores.strength);
  if (weapon.tags.includes("ranged")) return 0;
  return abilityModifier(hero.abilityScores.strength);
}

function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }
