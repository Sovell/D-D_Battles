import type { AbilityDefinition } from "../domain/types";

export const meleeAttack = (id: string, name: string, damage: AbilityDefinition["damage"], damageType: AbilityDefinition["damageType"] = "slashing"): AbilityDefinition => ({
  id, name, description: `${name}: d20 przeciw Obronie.`, range: 1, resourceCost: 0, target: "enemy", kind: "attack", damage, damageType,
});

export const rangedAttack = (id: string, name: string, range: number, damage: AbilityDefinition["damage"], damageType: AbilityDefinition["damageType"]): AbilityDefinition => ({
  id, name, description: `${name}: atak na dystans ${range}.`, range, resourceCost: 0, target: "enemy", kind: "attack", damage, damageType,
});
