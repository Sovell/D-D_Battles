import type { CampaignState, EquipmentSlot, HeroLoadout, HeroProfile, ItemEffect, ItemStack } from "../domain/types";
import { itemById } from "./items";

export function emptyLoadout(): HeroLoadout { return { weapon: null, armor: null, shield: null, cloak: null, boots: null, belt: null, trinket: null, consumables: [null, null, null] }; }

export function createCampaignState(heroes: HeroProfile[]): CampaignState {
  return { version: 1, heroes: structuredClone(heroes), inventory: starterInventory(), activePartyIds: heroes.slice(0, 4).map((hero) => hero.id), loadouts: Object.fromEntries(heroes.map((hero) => [hero.id, emptyLoadout()])) };
}

export function addItem(inventory: ItemStack[], definitionId: string, quantity = 1): ItemStack[] {
  const definition = itemById.get(definitionId);
  if (!definition || quantity <= 0) return structuredClone(inventory);
  const current = inventory.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  const accepted = definition.slot === "consumable" ? Math.min(definition.stackLimit, current + Math.floor(quantity)) : Math.min(1, current + Math.floor(quantity));
  return [...inventory.filter((stack) => stack.definitionId !== definitionId), ...(accepted > 0 ? [{ definitionId, quantity: accepted }] : [])];
}

export function equipItem(campaign: CampaignState, heroId: string, definitionId: string, consumableIndex = 0): CampaignState {
  const definition = itemById.get(definitionId);
  const loadout = campaign.loadouts[heroId];
  if (!definition || !loadout || !campaign.heroes.some((hero) => hero.id === heroId) || !(campaign.inventory.find((stack) => stack.definitionId === definitionId)?.quantity)) return campaign;
  const slot = definition.slot;
  const currentId = slot === "consumable" ? loadout.consumables[consumableIndex] : loadout[slot as Exclude<EquipmentSlot, "consumable">];
  if (slot === "consumable" && (consumableIndex < 0 || consumableIndex > 2)) return campaign;
  if (definition.tags.includes("two-handed") && loadout.shield) return campaign;
  if (slot === "shield" && loadout.weapon && itemById.get(loadout.weapon)?.tags.includes("two-handed")) return campaign;
  let inventory = removeOne(campaign.inventory, definitionId);
  if (currentId) inventory = addItem(inventory, currentId);
  const nextLoadout = slot === "consumable" ? { ...loadout, consumables: loadout.consumables.map((id, index) => index === consumableIndex ? definitionId : id) } : { ...loadout, [slot]: definitionId };
  return { ...campaign, inventory, loadouts: { ...campaign.loadouts, [heroId]: nextLoadout } };
}

export function unequipItem(campaign: CampaignState, heroId: string, slot: EquipmentSlot, consumableIndex = 0): CampaignState {
  const loadout = campaign.loadouts[heroId];
  if (!loadout) return campaign;
  const currentId = slot === "consumable" ? loadout.consumables[consumableIndex] : loadout[slot];
  if (!currentId) return campaign;
  const nextLoadout = slot === "consumable" ? { ...loadout, consumables: loadout.consumables.map((id, index) => index === consumableIndex ? null : id) } : { ...loadout, [slot]: null };
  return { ...campaign, inventory: addItem(campaign.inventory, currentId), loadouts: { ...campaign.loadouts, [heroId]: nextLoadout } };
}

export function equipmentBonuses(loadout: HeroLoadout): { defense: number; attack: number; speed: number; saves: { fortitude: number; reflex: number; will: number } } {
  const definitions = equippedIds(loadout).map((id) => itemById.get(id)).filter(Boolean);
  const defenseGroups = new Map<string, number>();
  let attack = 0; let speed = 0;
  const saves = { fortitude: 0, reflex: 0, will: 0 };
  for (const definition of definitions) for (const effect of definition!.effects) {
    if (effect.type === "stat" && effect.stat === "defense") defenseGroups.set(effect.stackingGroup ?? `item:${definition!.id}`, Math.max(defenseGroups.get(effect.stackingGroup ?? `item:${definition!.id}`) ?? 0, effect.value));
    if (effect.type === "stat" && effect.stat === "attack") attack += effect.value;
    if (effect.type === "stat" && effect.stat === "speed") speed += effect.value;
    if (effect.type === "save") for (const save of ["fortitude", "reflex", "will"] as const) if (effect.save === "all" || effect.save === save) saves[save] += effect.value;
  }
  return { defense: [...defenseGroups.values()].reduce((sum, value) => sum + value, 0), attack, speed, saves };
}

export function reconcileBattleItems(campaign: CampaignState, spent: Record<string, Record<string, number>> | undefined): CampaignState {
  if (!spent) return campaign;
  let next = campaign;
  for (const [heroId, itemUses] of Object.entries(spent)) for (const [itemId, uses] of Object.entries(itemUses)) {
    if (uses <= 0 || itemById.get(itemId)?.slot !== "consumable") continue;
    const loadout = next.loadouts[heroId];
    const effect = itemById.get(itemId)?.effects.find((candidate) => "charges" in candidate);
    const consumedCount = Math.max(1, Math.ceil(uses / Math.max(1, effect && "charges" in effect ? effect.charges ?? 1 : 1)));
    let remaining = consumedCount;
    if (loadout) next = { ...next, loadouts: { ...next.loadouts, [heroId]: { ...loadout, consumables: loadout.consumables.map((id) => id === itemId && remaining-- > 0 ? null : id) } } };
  }
  return next;
}

export function equippedIds(loadout: HeroLoadout): string[] { return [loadout.weapon, loadout.armor, loadout.shield, loadout.cloak, loadout.boots, loadout.belt, loadout.trinket, ...loadout.consumables].filter((id): id is string => Boolean(id)); }
export function scenarioUtilityEffects(loadout: HeroLoadout): Extract<ItemEffect, { type: "utility" }>[] { return equippedIds(loadout).flatMap((id) => itemById.get(id)?.effects.filter((effect): effect is Extract<ItemEffect, { type: "utility" }> => effect.type === "utility") ?? []); }

function removeOne(inventory: ItemStack[], definitionId: string): ItemStack[] { return inventory.flatMap((stack) => stack.definitionId !== definitionId ? [stack] : stack.quantity > 1 ? [{ ...stack, quantity: stack.quantity - 1 }] : []); }
function starterInventory(): ItemStack[] { return [{ definitionId: "longsword", quantity: 1 }, { definitionId: "chain-shirt", quantity: 1 }, { definitionId: "heavy-shield", quantity: 1 }, { definitionId: "thieves-tools", quantity: 1 }, { definitionId: "potion-cure-light", quantity: 3 }, { definitionId: "alchemists-fire", quantity: 2 }, { definitionId: "holy-water", quantity: 2 }]; }
