import { meleeAttack } from "../data/abilities";
import type { AbilityDefinition, HeroClassDefinition, HeroLoadout, ItemDefinition } from "../domain/types";
import { abilityModifier, baseAttackBonus } from "../progression/dnd35";
import { itemById } from "./items";

const spellcastingClasses = new Set(["wizard", "sorcerer"]);
const unarmedStrike = meleeAttack("unarmed-strike", "Unarmed Strike", { count: 1, sides: 4 }, "bludgeoning");

export function basicAttackForLoadout(hero: HeroClassDefinition, level: number, loadout: HeroLoadout, equipmentAttackBonus = 0): AbilityDefinition {
  if (spellcastingClasses.has(hero.id)) {
    const casting = hero.castingAbility ?? "intelligence";
    const attackBonus = baseAttackBonus(hero.baseAttackProgression, level) + abilityModifier(hero.abilityScores[casting]) + equipmentAttackBonus;
    return { ...hero.basicAttack, source: "spell-attack", attackBonusOverride: attackBonus, description: `${hero.basicAttack.description} Trafienie ${signed(attackBonus)} (BAB i ${casting}).` };
  }
  const weapon = loadout.weapon ? itemById.get(loadout.weapon) : undefined;
  if (weapon?.weapon) return weaponAttackForHero(hero, level, weapon, equipmentAttackBonus);
  if (hero.id === "monk") return unarmedAttackForHero(hero, level, hero.basicAttack);
  return unarmedAttackForHero(hero, level, unarmedStrike);
}

export function weaponSwitchAbility(classId: string, loadout: HeroLoadout): AbilityDefinition | undefined {
  if (spellcastingClasses.has(classId)) return undefined;
  const backup = loadout.backupWeapon ? itemById.get(loadout.backupWeapon) : undefined;
  if (!backup?.weapon || (backup.weapon.handedness === "two-handed" && loadout.shield)) return undefined;
  return { id: "switch-weapon", name: `Dobycie: ${backup.name}`, description: `Zamień broń główną z zapasową (${backup.name}). Zużywa akcję tej tury.`, range: 0, resourceCost: 0, target: "self", kind: "status", special: "switch-weapon" };
}

export function weaponTechniqueForLoadout(ability: AbilityDefinition, hero: HeroClassDefinition, level: number, loadout: HeroLoadout, attackAdjustment = 0): AbilityDefinition {
  if (ability.tags?.includes("spell") || (!ability.tags?.includes("melee") && !ability.tags?.includes("ranged"))) return ability;
  const weapon = loadout.weapon ? itemById.get(loadout.weapon) : undefined;
  const needsRanged = ability.tags.includes("ranged");
  const requiresShield = ability.tags.includes("requires-shield");
  const requiresDagger = ability.tags.includes("requires-dagger");
  const compatible = (!requiresShield || Boolean(loadout.shield)) && (!requiresDagger || weapon?.id === "dagger") && (hero.id === "monk" && !needsRanged || Boolean(weapon?.weapon && (needsRanged ? ["ranged", "thrown"].includes(weapon.weapon.attackKind) : weapon.weapon.attackKind === "melee")));
  if (!compatible) return { ...ability, source: "weapon-technique", tags: [...(ability.tags ?? []), "weapon-requirement-unmet"], description: `${ability.description} Wymaga aktywnej broni ${needsRanged ? "dystansowej" : "do walki wręcz"}.` };
  const basic = hero.id === "monk" ? unarmedAttackForHero(hero, level, hero.basicAttack) : weaponAttackForHero(hero, level, weapon!, attackAdjustment);
  const useWeaponDice = ["cleave", "reckless-charge", "smite-evil", "evasive-retreat", "aimed-shot"].includes(ability.id);
  const damage = useWeaponDice ? { ...(basic.damage ?? { count: 1, sides: 4 }), count: (basic.damage?.count ?? 1) + (ability.id === "aimed-shot" || ability.id === "reckless-charge" ? 1 : 0) } : ability.damage ? { ...ability.damage, bonus: basic.damage?.bonus ?? 0 } : basic.damage;
  return {
    ...ability,
    source: "weapon-technique",
    range: needsRanged ? Math.max(ability.range, basic.range) : ability.range,
    damage,
    damageType: basic.damageType,
    extraDamage: basic.extraDamage,
    attackBonusOverride: basic.attackBonusOverride,
    tags: (ability.tags ?? []).filter((tag) => tag !== "weapon-requirement-unmet"),
  };
}

function weaponAttackForHero(hero: HeroClassDefinition, level: number, weapon: ItemDefinition, equipmentAttackBonus: number): AbilityDefinition {
  const attackAbility = weaponAttackAbility(hero, weapon);
  const attackAbilityBonus = abilityModifier(hero.abilityScores[attackAbility]);
  const damageAbilityBonus = weaponDamageAbilityBonus(hero, weapon);
  const proficient = isWeaponProficient(hero, weapon);
  const nonProficiencyPenalty = proficient ? 0 : -4;
  const enhancement = weapon.weapon?.enhancementBonus ?? 0;
  const attackBonus = baseAttackBonus(hero.baseAttackProgression, level) + attackAbilityBonus + equipmentAttackBonus + enhancement + nonProficiencyPenalty;
  const profile = weapon.weapon!;
  const attack: AbilityDefinition = { id: weapon.id, name: weapon.name, description: weapon.description, range: profile.range, resourceCost: 0, target: "enemy", kind: "attack", damage: { ...profile.damage }, damageType: profile.damageType };
  const damage = { ...(attack.damage ?? { count: 1, sides: 4 }), bonus: damageAbilityBonus + enhancement };
  const abilityLabel = attackAbility === "strength" ? "Siła" : "Zręczność";
  return { ...attack, range: weapon.weapon?.range ?? attack.range, damageType: weapon.weapon?.damageType ?? attack.damageType, damage, extraDamage: weapon.weapon?.energyDamage, source: "weapon-attack", attackBonusOverride: attackBonus, tags: [...(attack.tags ?? []), "weapon-attack", proficient ? "proficient" : "not-proficient"], description: `${damage.count}k${damage.sides}${signed(damage.bonus ?? 0)} obrażeń${weapon.weapon?.energyDamage ? ` + ${weapon.weapon.energyDamage.damage.count}k${weapon.weapon.energyDamage.damage.sides} ${weapon.weapon.energyDamage.damageType}` : ""} · trafienie ${signed(attackBonus)} (BAB ${signed(baseAttackBonus(hero.baseAttackProgression, level))}, ${abilityLabel} ${signed(attackAbilityBonus)}${proficient ? "" : ", kara −4 za brak biegłości"}).` };
}

export function isWeaponProficient(hero: HeroClassDefinition, weapon: ItemDefinition): boolean {
  return hero.weaponProficiencies.includes(weapon.id) || (weapon.weapon ? hero.weaponProficiencies.includes(weapon.weapon.category) : hero.weaponProficiencies.some((entry) => weapon.tags.includes(entry)));
}

function unarmedAttackForHero(hero: HeroClassDefinition, level: number, attack: AbilityDefinition): AbilityDefinition {
  const abilityName = hero.id === "monk" ? "dexterity" : "strength";
  const abilityBonus = abilityModifier(hero.abilityScores[abilityName]);
  const strengthDamage = abilityModifier(hero.abilityScores.strength);
  const attackBonus = baseAttackBonus(hero.baseAttackProgression, level) + abilityBonus;
  const damage = { ...(attack.damage ?? { count: 1, sides: 4 }), bonus: strengthDamage };
  return { ...attack, damage, source: "weapon-attack", attackBonusOverride: attackBonus, tags: [...(attack.tags ?? []), "weapon-attack", "proficient"], description: `${damage.count}k${damage.sides}${signed(damage.bonus ?? 0)} obrażeń · trafienie ${signed(attackBonus)}.` };
}

function weaponAttackAbility(hero: HeroClassDefinition, weapon: ItemDefinition): "strength" | "dexterity" {
  if (weapon.weapon?.attackKind === "ranged" || weapon.weapon?.attackKind === "thrown") return "dexterity";
  if (hero.weaponFinesse && weapon.weapon?.finesseEligible && abilityModifier(hero.abilityScores.dexterity) > abilityModifier(hero.abilityScores.strength)) return "dexterity";
  return "strength";
}

function weaponDamageAbilityBonus(hero: HeroClassDefinition, weapon: ItemDefinition): number {
  if (weapon.weapon?.attackKind === "thrown") return abilityModifier(hero.abilityScores.strength);
  if (weapon.weapon?.attackKind === "ranged") return 0;
  const strength = abilityModifier(hero.abilityScores.strength);
  return weapon.weapon?.handedness === "two-handed" ? Math.floor(strength * 1.5) : strength;
}

function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }
