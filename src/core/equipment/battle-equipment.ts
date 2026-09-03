import type { AbilityDefinition, BattleState, Combatant, HeroLoadout, ItemDefinition } from "../domain/types";
import { equippedIds } from "./campaign";
import { itemById } from "./items";

export function itemAbilities(loadout: HeroLoadout): AbilityDefinition[] {
  const abilities: AbilityDefinition[] = [];
  for (const id of equippedIds(loadout)) {
    const definition = itemById.get(id);
    const effect = definition?.effects.find((candidate) => candidate.type === "healing" || candidate.type === "damage" || candidate.type === "status");
    if (!definition || !effect || (!definition.tags.includes("healing") && definition.slot !== "consumable" && !definition.id.startsWith("wand-")) || abilities.some((ability) => ability.id === abilityId(id))) continue;
    if (effect.type === "healing") abilities.push({ id: abilityId(id), name: definition.name, description: definition.description, range: effect.range ?? 0, resourceCost: 0, target: (effect.range ?? 0) > 0 ? "ally" : "self", kind: "heal", damage: { count: 0, sides: 1, bonus: effect.amount } });
    else if (effect.type === "status") abilities.push({ id: abilityId(id), name: definition.name, description: definition.description, range: 0, resourceCost: 0, target: "self", kind: "status", status: effect.status });
    else abilities.push({ id: abilityId(id), name: definition.name, description: definition.description, range: effect.range, resourceCost: 0, target: effect.area ? "cell" : "enemy", kind: "damage", damage: { count: 0, sides: 1, bonus: effect.amount }, damageType: effect.damageType, status: effect.status, area: effect.area });
  }
  return abilities;
}

export function itemAbilityAvailable(state: BattleState, actor: Combatant, id: string): boolean {
  const itemId = itemIdFromAbility(id);
  if (!itemId) return true;
  const profileId = actor.id.startsWith("hero-") ? actor.id.slice(5) : actor.id;
  const loadout = state.heroLoadoutSnapshots?.[profileId];
  if (!loadout) return false;
  const capacity = equippedIds(loadout).filter((equipped) => equipped === itemId).reduce((sum) => sum + charges(itemById.get(itemId)), 0);
  return (state.spentItemCharges?.[profileId]?.[itemId] ?? 0) < capacity;
}

export function recordItemAbilityUse(state: BattleState, actor: Combatant, id: string): BattleState {
  const itemId = itemIdFromAbility(id);
  if (!itemId) return state;
  const profileId = actor.id.startsWith("hero-") ? actor.id.slice(5) : actor.id;
  const heroUses = state.spentItemCharges?.[profileId] ?? {};
  return { ...state, spentItemCharges: { ...state.spentItemCharges, [profileId]: { ...heroUses, [itemId]: (heroUses[itemId] ?? 0) + 1 } } };
}

export function abilityId(itemId: string): string { return `item:${itemId}`; }
function itemIdFromAbility(id: string): string | undefined { return id.startsWith("item:") ? id.slice(5) : undefined; }
function charges(definition: ItemDefinition | undefined): number { const effect = definition?.effects.find((candidate) => "charges" in candidate && typeof candidate.charges === "number"); return effect && "charges" in effect ? effect.charges ?? 1 : 1; }
