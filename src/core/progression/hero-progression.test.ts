import { describe, expect, it } from "vitest";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt } from "../scenario/scenarios";
import { awardVictoryXp, awardXp, chooseProgressionOption, createHeroProfile, heroBattleStats, levelForXp, pendingProgressionLevels, validateParty } from "./hero-progression";

describe("hero progression", () => {
  it("uses deterministic level thresholds from 1 to 5", () => {
    expect([0, 99, 100, 249, 250, 449, 450, 699, 700, 9999].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("awards XP without mutating the original profile", () => {
    const profile = createHeroProfile({ id: "tordek", name: "Tordek", race: "dwarf", classId: "fighter" });
    const advanced = awardXp(profile, 250);
    expect(profile).toMatchObject({ xp: 0, level: 1 });
    expect(advanced).toMatchObject({ xp: 250, level: 3 });
    expect(pendingProgressionLevels(advanced)).toEqual([2, 3]);
  });

  it("awards scenario XP only to participating heroes", () => {
    const party = [
      createHeroProfile({ id: "a", name: "Aldric", race: "human", classId: "fighter" }),
      createHeroProfile({ id: "b", name: "Borin", race: "dwarf", classId: "cleric" }),
    ];
    const awarded = awardVictoryXp(party, ["b"], 140);
    expect(awarded.map((profile) => profile.xp)).toEqual([0, 140]);
    expect(awarded.map((profile) => profile.level)).toEqual([1, 2]);
    expect(party.map((profile) => profile.xp)).toEqual([0, 0]);
  });

  it("allows exactly one deterministic choice at every unlocked milestone", () => {
    let profile = awardXp(createHeroProfile({ id: "mialee", name: "Mialee", race: "elf", classId: "wizard" }), 700);
    profile = chooseProgressionOption(profile, "burning-hands");
    profile = chooseProgressionOption(profile, "talent-accuracy");
    profile = chooseProgressionOption(profile, "talent-resilience");
    expect(pendingProgressionLevels(profile)).toEqual([]);
    expect(profile.selectedAbilityIds).toEqual(["magic-missile", "burning-hands", "talent-accuracy", "talent-resilience"]);
  });

  it("applies small explicit race bonuses and level bonuses", () => {
    const human = heroBattleStats(createHeroProfile({ id: "h", name: "Human", race: "human", classId: "fighter" }));
    const dwarf = heroBattleStats(createHeroProfile({ id: "d", name: "Dwarf", race: "dwarf", classId: "fighter" }));
    const elf = heroBattleStats(createHeroProfile({ id: "e", name: "Elven", race: "elf", classId: "fighter" }));
    const halfling = heroBattleStats(createHeroProfile({ id: "a", name: "Halfling", race: "halfling", classId: "fighter" }));
    expect(human.maxCharges).toBe(3);
    expect(dwarf.maxHp).toBe(36);
    expect(elf.initiative).toBe(3);
    expect(halfling.defenseClass).toBe(18);
  });

  it("validates 3-4 unique saved profiles", () => {
    const profiles = ["a", "b", "c", "d"].map((id) => createHeroProfile({ id, name: `Hero ${id}`, race: "human", classId: "fighter" }));
    expect(validateParty(profiles, ["a", "b", "c"])).toEqual([]);
    expect(validateParty(profiles, ["a", "a", "c"])).toContain("Nie można wybrać tego samego bohatera dwa razy.");
    expect(validateParty(profiles, ["a", "b"])).toContain("Drużyna musi mieć 3–4 bohaterów.");
    expect(validateParty(profiles, ["a", "b", "missing"])).toContain("Drużyna zawiera nieznany profil bohatera.");
  });

  it("copies profiles into battle snapshots and never mutates the source", () => {
    const profile = createHeroProfile({ id: "ember", name: "Ember", race: "halfling", classId: "rogue", portraitVariant: 2 });
    const party = [profile, createHeroProfile({ id: "b", name: "Borin", race: "dwarf", classId: "cleric" }), createHeroProfile({ id: "c", name: "Celene", race: "elf", classId: "wizard" })];
    const battle = createBattle(70, cleanseTheCrypt, party);
    battle.heroSnapshots![0].name = "Changed only in battle";
    battle.combatants[0].hp = 1;
    expect(profile.name).toBe("Ember");
    expect(profile).not.toHaveProperty("hp");
  });

  it("builds combat abilities exclusively from the profile snapshot", () => {
    const novice = createHeroProfile({ id: "novice", name: "Novice", race: "human", classId: "wizard" });
    const advanced = chooseProgressionOption(awardXp(novice, 100), "burning-hands");
    const noviceStats = heroBattleStats(novice);
    const advancedStats = heroBattleStats(advanced);
    expect(noviceStats.abilities.map((ability) => ability.id)).toEqual(["magic-missile"]);
    expect(advancedStats.abilities.map((ability) => ability.id)).toEqual(["magic-missile", "burning-hands"]);
  });
});
