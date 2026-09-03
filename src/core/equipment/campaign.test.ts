import { describe, expect, it } from "vitest";
import { createLegacyRoster } from "../progression/hero-progression";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt } from "../scenario/scenarios";
import { activeCombatant, resolveAbility } from "../rules/combat";
import { addItem, createCampaignState, equipItem, equipmentBonuses, reconcileBattleItems, scenarioUtilityEffects, unequipItem } from "./campaign";

describe("campaign equipment", () => {
  it("equips and unequips without duplicating an item", () => {
    const hero = createLegacyRoster()[0];
    let campaign = createCampaignState([hero]);
    campaign = equipItem(campaign, hero.id, "longsword");
    expect(campaign.inventory.some((stack) => stack.definitionId === "longsword")).toBe(false);
    expect(campaign.loadouts[hero.id].weapon).toBe("longsword");
    campaign = unequipItem(campaign, hero.id, "weapon");
    expect(campaign.inventory.find((stack) => stack.definitionId === "longsword")?.quantity).toBe(1);
    expect(campaign.loadouts[hero.id].weapon).toBeNull();
  });

  it("stacks only consumables and caps their stack limit", () => {
    const campaign = createCampaignState([]);
    expect(addItem(campaign.inventory, "potion-cure-light", 20).find((stack) => stack.definitionId === "potion-cure-light")?.quantity).toBe(5);
    expect(addItem(campaign.inventory, "longsword", 4).find((stack) => stack.definitionId === "longsword")?.quantity).toBe(1);
  });

  it("enforces slots, two-handed conflicts and non-stacking defense groups", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = { ...campaign, inventory: addItem(addItem(addItem(campaign.inventory, "scale-mail"), "greataxe"), "amulet-natural-armor") };
    campaign = equipItem(equipItem(campaign, hero.id, "heavy-shield"), hero.id, "greataxe");
    expect(campaign.loadouts[hero.id].weapon).toBeNull();
    campaign = equipItem(equipItem(campaign, hero.id, "chain-shirt"), hero.id, "scale-mail");
    expect(campaign.loadouts[hero.id].armor).toBe("scale-mail");
    expect(equipmentBonuses(campaign.loadouts[hero.id]).defense).toBe(3);
  });

  it("keeps campaign immutable during battle and reconciles a consumed item afterwards", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = equipItem(campaign, hero.id, "potion-cure-light", 0);
    const before = structuredClone(campaign);
    let state = createBattle(84, cleanseTheCrypt, [hero], {}, campaign.loadouts);
    const fighter = state.combatants.find((unit) => unit.definitionId === "fighter")!;
    state = { ...state, activeIndex: state.initiativeOrder.indexOf(fighter.id), combatants: state.combatants.map((unit) => unit.id === fighter.id ? { ...unit, hp: unit.maxHp - 5 } : unit), pendingEventNotices: [] };
    const used = resolveAbility(state, fighter.id, "item:potion-cure-light", { kind: "self" });
    expect(campaign).toEqual(before);
    expect(used.spentItemCharges?.[hero.id]?.["potion-cure-light"]).toBe(1);
    expect(reconcileBattleItems(campaign, used.spentItemCharges).loadouts[hero.id].consumables[0]).toBeNull();
    expect(activeCombatant(used)?.id).toBe(fighter.id);
  });

  it("removes the correct number of duplicated consumed stacks", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = equipItem(equipItem(campaign, hero.id, "holy-water", 0), hero.id, "holy-water", 1);
    const reconciled = reconcileBattleItems(campaign, { [hero.id]: { "holy-water": 2 } });
    expect(reconciled.loadouts[hero.id].consumables.slice(0, 2)).toEqual([null, null]);
  });

  it("applies deterministic defense, save, speed and attack bonuses to a snapshot", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = { ...campaign, inventory: ["breastplate", "cloak-resistance-2", "boots-striding", "weapon-plus-1"].reduce((inventory, id) => addItem(inventory, id), campaign.inventory) };
    for (const id of ["breastplate", "cloak-resistance-2", "boots-striding", "weapon-plus-1"]) campaign = equipItem(campaign, hero.id, id);
    expect(equipmentBonuses(campaign.loadouts[hero.id])).toEqual({ defense: 3, attack: 1, speed: 0, saves: { fortitude: 2, reflex: 2, will: 2 } });
  });

  it("exposes data-driven utility effects for scenario rules", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = equipItem(campaign, hero.id, "thieves-tools");
    expect(scenarioUtilityEffects(campaign.loadouts[hero.id]).map((effect) => effect.utility)).toEqual(["locks", "traps"]);
  });
});
