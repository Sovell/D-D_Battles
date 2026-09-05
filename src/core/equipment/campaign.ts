import type { CampaignState, EquipmentSlot, HeroLoadout, HeroProfile, ItemEffect, ItemStack, PartyProfile } from "../domain/types";
import { itemById } from "./items";
import { heroClassById } from "../data/heroes";

export function emptyLoadout(): HeroLoadout { return { weapon: null, backupWeapon: null, armor: null, shield: null, cloak: null, boots: null, belt: null, trinket: null, consumables: [null, null, null] }; }

export function starterLoadoutForClass(classId: string): HeroLoadout {
  const loadout = emptyLoadout();
  const kits: Record<string, Partial<HeroLoadout>> = {
    fighter: { weapon: "longsword", backupWeapon: "dagger", armor: "chain-shirt", shield: "heavy-shield" },
    rogue: { weapon: "shortsword", backupWeapon: "shortbow", armor: "chain-shirt", trinket: "thieves-tools" },
    cleric: { weapon: "mace", backupWeapon: "dagger", armor: "scale-mail", shield: "heavy-shield" },
    wizard: { weapon: "wand-focus", armor: null, cloak: "cloak-resistance-1" },
    barbarian: { weapon: "greataxe", backupWeapon: "dagger", armor: "scale-mail" },
    bard: { weapon: "light-crossbow", backupWeapon: "shortsword", armor: "chain-shirt", trinket: "war-drum" },
    druid: { weapon: "quarterstaff", backupWeapon: "dagger", armor: "leather-armor", trinket: "druidic-focus" },
    monk: { weapon: "quarterstaff", backupWeapon: "dagger", trinket: "monk-bracers" },
    paladin: { weapon: "longsword", backupWeapon: "dagger", armor: "scale-mail", shield: "heavy-shield" },
    ranger: { weapon: "longbow", backupWeapon: "shortsword", armor: "chain-shirt" },
    sorcerer: { weapon: "wand-focus", armor: null, cloak: "cloak-resistance-1", trinket: "sorcerous-focus" },
  };
  return { ...loadout, ...(kits[classId] ?? {}) };
}

export function createCampaignState(heroes: HeroProfile[]): CampaignState {
  const memberIds = heroes.slice(0, 4).map((hero) => hero.id);
  const stash = starterInventory();
  const party: PartyProfile = { id: "party-1", name: "Pierwsza drużyna", memberIds, stash, gold: 0, materials: 0, expeditionHistory: [], createdAt: new Date(0).toISOString() };
  return { version: 2, campaignDefinitions: [], campaignRuns: [], heroes: structuredClone(heroes), parties: [party], selectedPartyId: party.id, inventory: stash, activePartyIds: memberIds, loadouts: Object.fromEntries(heroes.map((hero) => [hero.id, starterLoadoutForClass(hero.classId)])), starterKitsGranted: true };
}

export function selectedParty(campaign: CampaignState): PartyProfile | undefined { return campaign.parties.find((party) => party.id === campaign.selectedPartyId); }

export function selectParty(campaign: CampaignState, partyId: string): CampaignState {
  const party = campaign.parties.find((candidate) => candidate.id === partyId);
  return party ? { ...campaign, selectedPartyId: party.id, activePartyIds: [...party.memberIds], inventory: party.stash } : campaign;
}

export function createParty(campaign: CampaignState, name: string, memberIds: string[], now = new Date().toISOString()): CampaignState {
  const unique = [...new Set(memberIds)];
  if (unique.length < 3 || unique.length > 4 || unique.some((id) => !campaign.heroes.some((hero) => hero.id === id)) || unique.some((id) => campaign.parties.some((party) => party.memberIds.includes(id)))) return campaign;
  const id = `party-${Date.now()}-${campaign.parties.length + 1}`;
  const party: PartyProfile = { id, name: name.trim() || `Drużyna ${campaign.parties.length + 1}`, memberIds: unique, stash: [], gold: 0, materials: 0, expeditionHistory: [], createdAt: now };
  return { ...campaign, parties: [...campaign.parties, party], selectedPartyId: id, activePartyIds: unique, inventory: party.stash };
}

export function renameParty(campaign: CampaignState, partyId: string, name: string): CampaignState {
  const normalized = name.trim();
  return normalized ? { ...campaign, parties: campaign.parties.map((party) => party.id === partyId ? { ...party, name: normalized } : party) } : campaign;
}

export function assignHeroToParty(campaign: CampaignState, heroId: string, partyId: string): CampaignState {
  const target = campaign.parties.find((party) => party.id === partyId);
  const source = campaign.parties.find((party) => party.memberIds.includes(heroId));
  if (!target || target.memberIds.includes(heroId) || target.memberIds.length >= 4 || (source && source.memberIds.length <= 3) || !campaign.heroes.some((hero) => hero.id === heroId)) return campaign;
  const parties = campaign.parties.map((party) => party.id === partyId ? { ...party, memberIds: [...party.memberIds, heroId] } : { ...party, memberIds: party.memberIds.filter((id) => id !== heroId) });
  const selected = parties.find((party) => party.id === campaign.selectedPartyId)!;
  return { ...campaign, parties, activePartyIds: [...selected.memberIds], inventory: selected.stash };
}

export function removeHeroFromParty(campaign: CampaignState, heroId: string): CampaignState {
  const source = campaign.parties.find((party) => party.memberIds.includes(heroId));
  if (source && source.memberIds.length <= 3) return campaign;
  const parties = campaign.parties.map((party) => ({ ...party, memberIds: party.memberIds.filter((id) => id !== heroId) }));
  const selected = parties.find((party) => party.id === campaign.selectedPartyId)!;
  return { ...campaign, parties, activePartyIds: [...selected.memberIds], inventory: selected.stash };
}

export function deleteHero(campaign: CampaignState, heroId: string): CampaignState {
  if (!campaign.heroes.some((hero) => hero.id === heroId)) return campaign;
  const owner = campaign.parties.find((party) => party.memberIds.includes(heroId));
  if (owner && owner.memberIds.length <= 3) return campaign;
  const returnPartyId = owner?.id ?? campaign.selectedPartyId;
  const returnedStash = carriedIds(campaign.loadouts[heroId] ?? emptyLoadout()).reduce((stash, definitionId) => addItem(stash, definitionId), campaign.parties.find((party) => party.id === returnPartyId)?.stash ?? []);
  const parties = campaign.parties.map((party) => ({
    ...party,
    memberIds: party.memberIds.filter((id) => id !== heroId),
    stash: party.id === returnPartyId ? returnedStash : party.stash,
  }));
  const loadouts = { ...campaign.loadouts };
  delete loadouts[heroId];
  const selected = parties.find((party) => party.id === campaign.selectedPartyId)!;
  return {
    ...campaign,
    heroes: campaign.heroes.filter((hero) => hero.id !== heroId),
    parties,
    loadouts,
    activePartyIds: [...selected.memberIds],
    inventory: selected.stash,
  };
}

export function deleteParty(campaign: CampaignState, partyId: string): CampaignState {
  if (campaign.campaignRuns.some((run) => run.partyId === partyId)) return campaign;
  const target = campaign.parties.find((party) => party.id === partyId);
  if (!target || target.stash.length || target.gold || target.materials || campaign.parties.length <= 1) return campaign;
  const parties = campaign.parties.filter((party) => party.id !== partyId);
  const selected = parties.find((party) => party.id === campaign.selectedPartyId) ?? parties[0];
  return { ...campaign, parties, selectedPartyId: selected.id, activePartyIds: [...selected.memberIds], inventory: selected.stash };
}

export function transferStashItem(campaign: CampaignState, fromPartyId: string, toPartyId: string, definitionId: string): CampaignState {
  if (fromPartyId === toPartyId) return campaign;
  const from = campaign.parties.find((party) => party.id === fromPartyId);
  const to = campaign.parties.find((party) => party.id === toPartyId);
  if (!from || !to || !from.stash.some((stack) => stack.definitionId === definitionId)) return campaign;
  const nextTarget = addItem(to.stash, definitionId);
  const before = to.stash.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  const after = nextTarget.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  if (after <= before) return campaign;
  const parties = campaign.parties.map((party) => party.id === fromPartyId ? { ...party, stash: removeOne(party.stash, definitionId) } : party.id === toPartyId ? { ...party, stash: nextTarget } : party);
  const selected = parties.find((party) => party.id === campaign.selectedPartyId)!;
  return { ...campaign, parties, inventory: selected.stash };
}

export function addItem(inventory: ItemStack[], definitionId: string, quantity = 1): ItemStack[] {
  const definition = itemById.get(definitionId);
  if (!definition || quantity <= 0) return structuredClone(inventory);
  const current = inventory.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  const stackLimit = definition.slot === "consumable" ? definition.stackLimit : 20;
  const accepted = Math.max(current, Math.min(stackLimit, current + Math.floor(quantity)));
  return [...inventory.filter((stack) => stack.definitionId !== definitionId), ...(accepted > 0 ? [{ definitionId, quantity: accepted }] : [])];
}

export function equipItem(campaign: CampaignState, heroId: string, definitionId: string, consumableIndex = 0): CampaignState {
  const definition = itemById.get(definitionId);
  const loadout = campaign.loadouts[heroId];
  if (!definition || !loadout || !canEquip(campaign, heroId, definitionId, definition.slot, consumableIndex).ok) return campaign;
  const slot = definition.slot;
  const currentId = slot === "consumable" ? loadout.consumables[consumableIndex] : loadout[slot as Exclude<EquipmentSlot, "consumable">];
  if (slot === "consumable" && (consumableIndex < 0 || consumableIndex > 2)) return campaign;
  let inventory = removeOne(campaign.inventory, definitionId);
  if (currentId) inventory = addItem(inventory, currentId);
  const nextLoadout = slot === "consumable" ? { ...loadout, consumables: loadout.consumables.map((id, index) => index === consumableIndex ? definitionId : id) } : { ...loadout, [slot]: definitionId };
  return withSelectedStash({ ...campaign, loadouts: { ...campaign.loadouts, [heroId]: nextLoadout } }, inventory);
}

export function unequipItem(campaign: CampaignState, heroId: string, slot: EquipmentSlot, consumableIndex = 0): CampaignState {
  const loadout = campaign.loadouts[heroId];
  if (!loadout) return campaign;
  const currentId = slot === "consumable" ? loadout.consumables[consumableIndex] : loadout[slot];
  if (!currentId) return campaign;
  const nextLoadout = slot === "consumable" ? { ...loadout, consumables: loadout.consumables.map((id, index) => index === consumableIndex ? null : id) } : { ...loadout, [slot]: null };
  return withSelectedStash({ ...campaign, loadouts: { ...campaign.loadouts, [heroId]: nextLoadout } }, addItem(campaign.inventory, currentId));
}

export function equipBackupWeapon(campaign: CampaignState, heroId: string, definitionId: string): CampaignState {
  const definition = itemById.get(definitionId);
  const loadout = campaign.loadouts[heroId];
  if (!definition || definition.slot !== "weapon" || !loadout || !canEquip(campaign, heroId, definitionId, "weapon", 0, true).ok) return campaign;
  let inventory = removeOne(campaign.inventory, definitionId);
  if (loadout.backupWeapon) inventory = addItem(inventory, loadout.backupWeapon);
  return withSelectedStash({ ...campaign, loadouts: { ...campaign.loadouts, [heroId]: { ...loadout, backupWeapon: definitionId } } }, inventory);
}

export type EquipCheck = { ok: true } | { ok: false; reason: string };
export function canEquip(campaign: CampaignState, heroId: string, definitionId: string, requestedSlot?: EquipmentSlot, consumableIndex = 0, asBackup = false): EquipCheck {
  const hero = campaign.heroes.find((candidate) => candidate.id === heroId);
  const heroClass = hero ? heroClassById.get(hero.classId) : undefined;
  const definition = itemById.get(definitionId);
  const loadout = campaign.loadouts[heroId];
  const party = selectedParty(campaign);
  if (!hero || !heroClass || !loadout || !definition) return { ok: false, reason: "Nieznany bohater, klasa albo przedmiot." };
  if (!party?.memberIds.includes(heroId)) return { ok: false, reason: "Bohater nie należy do wybranej drużyny." };
  if (!(campaign.inventory.find((stack) => stack.definitionId === definitionId)?.quantity)) return { ok: false, reason: "Przedmiotu nie ma w magazynie tej drużyny." };
  if (requestedSlot && definition.slot !== requestedSlot && !(asBackup && definition.slot === "weapon")) return { ok: false, reason: "Przedmiot nie pasuje do wybranego miejsca." };
  if (definition.slot === "consumable" && (consumableIndex < 0 || consumableIndex > 2)) return { ok: false, reason: "Nieprawidłowe miejsce na przedmiot jednorazowy." };
  if (definition.armor && !heroClass.armorProficiencies.includes(definition.armor.category)) return { ok: false, reason: `Klasa nie ma biegłości w pancerzu ${definition.armor.category}.` };
  if (definition.armor && heroClass.forbidsMetalArmor && definition.armor.material === "metal") return { ok: false, reason: "Druid nie może używać metalowego pancerza." };
  if (definition.slot === "shield" && !heroClass.shieldProficiency) return { ok: false, reason: "Klasa nie ma biegłości w tarczach." };
  const primary = asBackup ? loadout.weapon : definition.slot === "weapon" ? definitionId : loadout.weapon;
  const backup = asBackup ? definitionId : loadout.backupWeapon;
  const shield = definition.slot === "shield" ? definitionId : loadout.shield;
  if (shield && [primary, backup].some((id) => id && itemById.get(id)?.weapon?.handedness === "two-handed")) return { ok: false, reason: "Tarcza koliduje z dwuręczną bronią główną lub zapasową." };
  if (heroClass.id === "monk" && (definition.armor || definition.slot === "shield")) return { ok: false, reason: "Monk korzysta z obrony bez pancerza i tarczy." };
  const currentId = asBackup ? loadout.backupWeapon : definition.slot === "consumable" ? loadout.consumables[consumableIndex] : loadout[definition.slot];
  const currentHighRarity = equippedIds(loadout).filter((id) => id !== currentId && ["rare", "epic"].includes(itemById.get(id)?.rarity ?? "")).length;
  if (["rare", "epic"].includes(definition.rarity) && currentHighRarity >= 1) return { ok: false, reason: "Bohater może mieć tylko jeden założony przedmiot rare lub epic." };
  return { ok: true };
}

export function unequipBackupWeapon(campaign: CampaignState, heroId: string): CampaignState {
  const loadout = campaign.loadouts[heroId];
  if (!loadout?.backupWeapon) return campaign;
  return withSelectedStash({ ...campaign, loadouts: { ...campaign.loadouts, [heroId]: { ...loadout, backupWeapon: null } } }, addItem(campaign.inventory, loadout.backupWeapon));
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

export function reconcileBattleItems(campaign: CampaignState, spent: Record<string, Record<string, number>> | undefined, battleLoadouts?: Record<string, HeroLoadout>): CampaignState {
  let next = campaign;
  for (const [heroId, itemUses] of Object.entries(spent ?? {})) for (const [itemId, uses] of Object.entries(itemUses)) {
    if (uses <= 0 || itemById.get(itemId)?.slot !== "consumable") continue;
    const loadout = next.loadouts[heroId];
    const effect = itemById.get(itemId)?.effects.find((candidate) => "charges" in candidate);
    const consumedCount = Math.max(1, Math.ceil(uses / Math.max(1, effect && "charges" in effect ? effect.charges ?? 1 : 1)));
    let remaining = consumedCount;
    if (loadout) next = { ...next, loadouts: { ...next.loadouts, [heroId]: { ...loadout, consumables: loadout.consumables.map((id) => id === itemId && remaining-- > 0 ? null : id) } } };
  }
  if (battleLoadouts) next = { ...next, loadouts: Object.fromEntries(Object.entries(next.loadouts).map(([heroId, loadout]) => {
    const battleLoadout = battleLoadouts[heroId];
    return [heroId, battleLoadout ? { ...loadout, weapon: battleLoadout.weapon, backupWeapon: battleLoadout.backupWeapon ?? null } : loadout];
  })) };
  return next;
}

export function equippedIds(loadout: HeroLoadout): string[] { return [loadout.weapon, loadout.armor, loadout.shield, loadout.cloak, loadout.boots, loadout.belt, loadout.trinket, loadout.ring, ...loadout.consumables].filter((id): id is string => Boolean(id)); }
export function carriedIds(loadout: HeroLoadout): string[] { return [loadout.weapon, loadout.backupWeapon, loadout.armor, loadout.shield, loadout.cloak, loadout.boots, loadout.belt, loadout.trinket, loadout.ring, ...loadout.consumables].filter((id): id is string => Boolean(id)); }
export function scenarioUtilityEffects(loadout: HeroLoadout): Extract<ItemEffect, { type: "utility" }>[] { return equippedIds(loadout).flatMap((id) => itemById.get(id)?.effects.filter((effect): effect is Extract<ItemEffect, { type: "utility" }> => effect.type === "utility") ?? []); }

function removeOne(inventory: ItemStack[], definitionId: string): ItemStack[] { return inventory.flatMap((stack) => stack.definitionId !== definitionId ? [stack] : stack.quantity > 1 ? [{ ...stack, quantity: stack.quantity - 1 }] : []); }
function starterInventory(): ItemStack[] { return [{ definitionId: "potion-cure-light", quantity: 3 }, { definitionId: "alchemists-fire", quantity: 2 }, { definitionId: "holy-water", quantity: 2 }]; }
export function withSelectedStash(campaign: CampaignState, stash: ItemStack[]): CampaignState {
  return { ...campaign, inventory: stash, parties: campaign.parties.map((party) => party.id === campaign.selectedPartyId ? { ...party, stash } : party) };
}
