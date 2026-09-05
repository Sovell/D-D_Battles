import { describe, expect, it } from "vitest";
import { createCampaignState, equipItem, starterLoadoutForClass } from "../equipment/campaign";
import { addItem } from "../equipment/campaign";
import { createHeroProfile } from "./hero-progression";
import { deriveCombatStats, spellSaveDc } from "./derived-combat-stats";
import { heroBattleStats } from "./hero-progression";
import { basicAttackForLoadout } from "../equipment/weapon-attacks";

describe("D&D 3.5 derived combat statistics", () => {
  it("derives BAB, ability modifiers, HP, saves, initiative and typed AC from one path", () => {
    const profile = { ...createHeroProfile({ id: "dwarf-fighter", name: "Tordek", race: "dwarf", classId: "fighter" }), level: 4, xp: 450, abilityScoreIncreases: { strength: 1 } };
    const stats = deriveCombatStats(profile, starterLoadoutForClass("fighter"));
    expect(stats.abilityScores).toMatchObject({ strength: 17, constitution: 18, charisma: 8 });
    expect(stats.abilityModifiers).toMatchObject({ strength: 3, constitution: 4 });
    expect(stats.bab).toBe(4);
    expect(stats.acBreakdown).toMatchObject({ base: 10, dexterity: 1, armor: 4, shield: 2 });
    expect(stats.defenseClass).toBe(17);
    expect(stats.saves.fortitude).toBe(8);
    expect(stats.initiative).toBe(2);
    expect(stats.basicAttack.attackBonusOverride).toBe(7);
  });

  it("keeps natural armor and deflection as separate stacking types", () => {
    const hero = createHeroProfile({ id: "fighter", name: "Regdar", race: "human", classId: "fighter" });
    let campaign = createCampaignState([hero, createHeroProfile({ id: "r", name: "Rogue", race: "human", classId: "rogue" }), createHeroProfile({ id: "c", name: "Cleric", race: "human", classId: "cleric" })]);
    campaign = { ...campaign, inventory: addItem(addItem(campaign.inventory, "amulet-natural-armor"), "ring-protection") };
    campaign = equipItem(campaign, hero.id, "amulet-natural-armor");
    campaign = equipItem(campaign, hero.id, "ring-protection");
    const stats = deriveCombatStats(hero, campaign.loadouts[hero.id]);
    expect(stats.acBreakdown.naturalArmor).toBe(1);
    expect(stats.acBreakdown.deflection).toBe(1);
    expect(stats.defenseClass).toBe(19);
  });

  it("calculates spell DC from rank and casting ability", () => {
    const wizard = createHeroProfile({ id: "wizard", name: "Mialee", race: "elf", classId: "wizard" });
    expect(spellSaveDc(wizard, 1)).toBe(14);
    expect(spellSaveDc({ ...wizard, level: 4, abilityScoreIncreases: { intelligence: 1 } }, 2)).toBe(16);
  });

  it("uses good and poor save progressions at levels 1-5", () => {
    const base = createHeroProfile({ id: "fighter-saves", name: "Regdar", race: "human", classId: "fighter" });
    const values = [1, 2, 3, 4, 5].map((level) => deriveCombatStats({ ...base, level }, starterLoadoutForClass("fighter")));
    expect(values.map((stats) => stats.saveBreakdown.fortitude.base)).toEqual([2, 3, 3, 4, 4]);
    expect(values.map((stats) => stats.saveBreakdown.reflex.base)).toEqual([0, 0, 1, 1, 1]);
  });

  it("applies melee, ranged, thrown, finesse, two-handed and nonproficiency formulas", () => {
    const fighter = heroBattleStats(createHeroProfile({ id: "f", name: "Fighter", race: "human", classId: "fighter" }));
    const rogue = heroBattleStats(createHeroProfile({ id: "r", name: "Rogue", race: "human", classId: "rogue" }));
    const barbarian = heroBattleStats(createHeroProfile({ id: "b", name: "Barbarian", race: "human", classId: "barbarian" }));
    const cleric = heroBattleStats(createHeroProfile({ id: "c", name: "Cleric", race: "human", classId: "cleric" }));
    const loadout = (weapon: string) => ({ ...starterLoadoutForClass("fighter"), weapon, shield: null });
    expect(basicAttackForLoadout(fighter, 1, loadout("longsword"))).toMatchObject({ attackBonusOverride: 4, damage: { bonus: 3 } });
    expect(basicAttackForLoadout(fighter, 1, loadout("longbow"))).toMatchObject({ attackBonusOverride: 2, damage: { bonus: 0 } });
    expect(basicAttackForLoadout(rogue, 1, loadout("dagger"))).toMatchObject({ attackBonusOverride: 3, damage: { bonus: 0 } });
    expect(basicAttackForLoadout(rogue, 1, loadout("shortsword"))).toMatchObject({ attackBonusOverride: 3, damage: { bonus: 0 } });
    expect(basicAttackForLoadout(barbarian, 1, loadout("greataxe"))).toMatchObject({ attackBonusOverride: 4, damage: { bonus: 4 } });
    expect(basicAttackForLoadout(cleric, 1, loadout("longsword"))).toMatchObject({ attackBonusOverride: -2, tags: expect.arrayContaining(["not-proficient"]) });
  });

  it("lets Constitution, Dexterity and Wisdom drive their derived statistics", () => {
    const human = createHeroProfile({ id: "h", name: "Human", race: "human", classId: "fighter" });
    const dwarf = { ...createHeroProfile({ id: "d", name: "Dwarf", race: "dwarf", classId: "fighter" }), level: 5 };
    expect(deriveCombatStats(dwarf, starterLoadoutForClass("fighter")).maxHp).toBeGreaterThan(deriveCombatStats({ ...human, level: 5 }, starterLoadoutForClass("fighter")).maxHp);
    const monk = createHeroProfile({ id: "m", name: "Monk", race: "elf", classId: "monk" });
    const stats = deriveCombatStats(monk, starterLoadoutForClass("monk"));
    expect(stats.saves.reflex).toBe(stats.saveBreakdown.reflex.base + stats.abilityModifiers.dexterity);
    expect(stats.saves.will).toBe(stats.saveBreakdown.will.base + stats.abilityModifiers.wisdom);
    expect(stats.initiative).toBe(stats.abilityModifiers.dexterity + 3);
  });

  it("removes only the class unarmored AC contribution when armor is present", () => {
    const barbarian = createHeroProfile({ id: "barbarian", name: "Krusk", race: "human", classId: "barbarian" });
    const unarmored = deriveCombatStats(barbarian, { ...starterLoadoutForClass("barbarian"), armor: null });
    const armored = deriveCombatStats(barbarian, starterLoadoutForClass("barbarian"));
    expect(unarmored.acBreakdown.other).toBe(3);
    expect(armored.acBreakdown.other).toBe(0);
    expect(armored.acBreakdown.base).toBe(10);
    expect(armored.acBreakdown.dexterity).toBe(2);
  });
});
