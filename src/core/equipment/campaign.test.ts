import { describe, expect, it } from "vitest";
import { createHeroProfile, createLegacyRoster } from "../progression/hero-progression";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt } from "../scenario/scenarios";
import { activeCombatant, resolveAbility } from "../rules/combat";
import { addItem, createCampaignState, deleteHero, equipItem, equipmentBonuses, reconcileBattleItems, scenarioUtilityEffects, starterLoadoutForClass, unequipItem } from "./campaign";

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
    expect(addItem(campaign.inventory, "longsword", 4).find((stack) => stack.definitionId === "longsword")?.quantity).toBe(4);
  });

  it("enforces slots, two-handed conflicts and non-stacking defense groups", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = { ...campaign, inventory: addItem(addItem(addItem(campaign.inventory, "scale-mail"), "greataxe"), "amulet-natural-armor") };
    campaign = equipItem(equipItem(campaign, hero.id, "heavy-shield"), hero.id, "greataxe");
    expect(campaign.loadouts[hero.id].weapon).toBe("longsword");
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

  it("applies bonuses and enforces one Rare/Epic item per hero", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = { ...campaign, inventory: ["breastplate", "cloak-resistance-2", "boots-striding", "weapon-plus-1"].reduce((inventory, id) => addItem(inventory, id), campaign.inventory) };
    for (const id of ["breastplate", "cloak-resistance-2", "boots-striding", "weapon-plus-1"]) campaign = equipItem(campaign, hero.id, id);
    expect(campaign.loadouts[hero.id].boots).toBeNull();
    expect(equipmentBonuses(campaign.loadouts[hero.id])).toEqual({ defense: 4, attack: 1, speed: -1, saves: { fortitude: 2, reflex: 2, will: 2 } });
  });

  it("exposes data-driven utility effects for scenario rules", () => {
    const hero = createLegacyRoster()[0]; let campaign = createCampaignState([hero]);
    campaign = { ...campaign, inventory: addItem(campaign.inventory, "thieves-tools") };
    campaign = equipItem(campaign, hero.id, "thieves-tools");
    expect(scenarioUtilityEffects(campaign.loadouts[hero.id]).map((effect) => effect.utility)).toEqual(["locks", "traps"]);
  });

  it("grants class starter kits with an active and backup weapon", () => {
    expect(starterLoadoutForClass("ranger")).toMatchObject({ weapon: "longbow", backupWeapon: "shortsword", armor: "chain-shirt" });
    const fighter = createCampaignState(createLegacyRoster()).loadouts.fighter;
    expect(fighter).toMatchObject({ weapon: "longsword", backupWeapon: "dagger", armor: "chain-shirt", shield: "heavy-shield" });
  });

  it("uses the wielded weapon for the basic attack and spends an action to switch it", () => {
    const ranger = createHeroProfile({ id: "test-ranger", name: "Sylva", race: "elf", classId: "ranger" });
    const campaign = createCampaignState([ranger]);
    let state = createBattle(91, cleanseTheCrypt, [ranger], {}, campaign.loadouts);
    const actor = state.combatants.find((unit) => unit.definitionId === "ranger")!;
    state = { ...state, activeIndex: state.initiativeOrder.indexOf(actor.id), pendingEventNotices: [] };
    expect(actor.basicAttack).toMatchObject({ id: "longbow", range: 8, damage: { count: 1, sides: 8, bonus: 0 } });
    expect(actor.abilities.some((ability) => ability.special === "switch-weapon")).toBe(true);
    const switched = resolveAbility(state, actor.id, "switch-weapon", { kind: "self" });
    expect(switched.combatants.find((unit) => unit.id === actor.id)).toMatchObject({ acted: true, basicAttack: { id: "shortsword", range: 1 } });
    expect(switched.heroLoadoutSnapshots?.[ranger.id]).toMatchObject({ weapon: "shortsword", backupWeapon: "longbow" });
    expect(reconcileBattleItems(campaign, switched.spentItemCharges, switched.heroLoadoutSnapshots).loadouts[ranger.id]).toMatchObject({ weapon: "shortsword", backupWeapon: "longbow" });
  });

  it("keeps the Wizard's cantrip as the basic attack despite an equipped focus", () => {
    const wizard = createLegacyRoster().find((hero) => hero.classId === "wizard")!;
    const state = createBattle(92, cleanseTheCrypt, [wizard]);
    expect(state.combatants.find((unit) => unit.definitionId === "wizard")?.basicAttack.id).toBe("fire-bolt");
  });

  it("derives accuracy and damage from class attributes and weapon proficiency", () => {
    const ranger = createHeroProfile({ id: "archer", name: "Archer", race: "human", classId: "ranger" });
    const paladin = createHeroProfile({ id: "knight", name: "Knight", race: "human", classId: "paladin" });
    const rogue = createHeroProfile({ id: "scout", name: "Scout", race: "human", classId: "rogue" });
    const loadouts = {
      [ranger.id]: starterLoadoutForClass("ranger"),
      [paladin.id]: { ...starterLoadoutForClass("paladin"), weapon: "longbow", shield: null },
      [rogue.id]: { ...starterLoadoutForClass("rogue"), weapon: "longbow" },
    };
    const state = createBattle(93, cleanseTheCrypt, [ranger, paladin, rogue], {}, loadouts);
    const rangerAttack = state.combatants.find((unit) => unit.definitionId === "ranger")!.basicAttack;
    const paladinAttack = state.combatants.find((unit) => unit.definitionId === "paladin")!.basicAttack;
    const rogueAttack = state.combatants.find((unit) => unit.definitionId === "rogue")!.basicAttack;
    expect(rangerAttack).toMatchObject({ attackBonusOverride: 4, damage: { count: 1, sides: 8, bonus: 0 } });
    expect(paladinAttack).toMatchObject({ attackBonusOverride: 1, damage: { count: 1, sides: 8, bonus: 0 } });
    expect(rogueAttack).toMatchObject({ attackBonusOverride: -1, damage: { count: 1, sides: 8, bonus: 0 }, tags: expect.arrayContaining(["not-proficient"]) });
  });

  it("deletes a hero atomically and returns equipped items to the party stash", () => {
    const heroes = createLegacyRoster();
    let campaign = createCampaignState(heroes);
    campaign = equipItem(campaign, heroes[0].id, "longsword");
    expect(campaign.inventory.some((stack) => stack.definitionId === "longsword")).toBe(false);
    const deleted = deleteHero(campaign, heroes[0].id);
    expect(deleted.heroes.some((hero) => hero.id === heroes[0].id)).toBe(false);
    expect(deleted.parties[0].memberIds).not.toContain(heroes[0].id);
    expect(deleted.loadouts).not.toHaveProperty(heroes[0].id);
    expect(deleted.inventory.find((stack) => stack.definitionId === "longsword")?.quantity).toBe(1);
    expect(deleted.activePartyIds).toHaveLength(3);
  });
});
