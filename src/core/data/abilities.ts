import type { AbilityDefinition } from "../domain/types";

export const meleeAttack = (id: string, name: string, damage: AbilityDefinition["damage"], damageType: AbilityDefinition["damageType"] = "slashing"): AbilityDefinition => ({
  id, name, description: `${name}: d20 przeciw Obronie, ${formatDamage(damage)} obrażeń.`, range: 1, resourceCost: 0, target: "enemy", kind: "attack", damage, damageType,
});

export const rangedAttack = (id: string, name: string, range: number, damage: AbilityDefinition["damage"], damageType: AbilityDefinition["damageType"]): AbilityDefinition => ({
  id, name, description: `${name}: atak na dystans ${range}, ${formatDamage(damage)} obrażeń.`, range, resourceCost: 0, target: "enemy", kind: "attack", damage, damageType,
});

function formatDamage(damage: AbilityDefinition["damage"]): string {
  if (!damage) return "1k4";
  return `${damage.count}k${damage.sides}${damage.bonus ? `${damage.bonus > 0 ? "+" : ""}${damage.bonus}` : ""}`;
}
