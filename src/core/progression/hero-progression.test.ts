import { describe, expect, it } from "vitest";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt } from "../scenario/scenarios";
import { awardVictoryXp, awardXp, chooseProgressionOption, createHeroProfile, heroBattleStats, increaseAbilityScore, levelForXp, pendingAbilityScoreIncreases, pendingProgressionLevels, validateParty } from "./hero-progression";
import { baseAttackBonus } from "./dnd35";

describe("hero progression", () => {
  it("uses deterministic level thresholds from 1 to 5", () => {
    expect([0, 99, 100, 249, 250, 449, 450, 699, 700, 9999].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("uses D&D 3.5 good, average and poor Base Attack Bonus progressions", () => {
    expect([1, 2, 3, 4, 5].map((level) => baseAttackBonus("good", level))).toEqual([1, 2, 3, 4, 5]);
    expect([1, 2, 3, 4, 5].map((level) => baseAttackBonus("average", level))).toEqual([0, 1, 2, 3, 3]);
    expect([1, 2, 3, 4, 5].map((level) => baseAttackBonus("poor", level))).toEqual([0, 1, 1, 2, 2]);
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
    let profile = awardXp(createHeroProfile({ id: "sylva", name: "Sylva", race: "elf", classId: "ranger" }), 700);
    profile = chooseProgressionOption(profile, "talent-vitality");
    profile = chooseProgressionOption(profile, "evasive-retreat");
    profile = chooseProgressionOption(profile, "volley");
    expect(pendingProgressionLevels(profile)).toEqual([]);
    expect(profile.selectedAbilityIds).toEqual(["hunters-mark", "aimed-shot", "set-snare", "talent-vitality", "evasive-retreat", "volley"]);
  });

  it("grants one permanent ability point at level 4 following D&D 3.5", () => {
    const levelFour = awardXp(createHeroProfile({ id: "level-four", name: "Sylva", race: "human", classId: "ranger" }), 450);
    expect(pendingAbilityScoreIncreases(levelFour)).toBe(1);
    const improved = increaseAbilityScore(levelFour, "dexterity");
    expect(improved.abilityScoreIncreases).toEqual({ dexterity: 1 });
    expect(heroBattleStats(improved).abilityScores.dexterity).toBe(18);
    expect(createBattle(71, cleanseTheCrypt, [improved]).combatants.find((unit) => unit.definitionId === "ranger")?.basicAttack.attackBonusOverride).toBe(8);
    expect(pendingAbilityScoreIncreases(improved)).toBe(0);
    expect(increaseAbilityScore(improved, "strength")).toBe(improved);
  });

  it("applies canonical D&D 3.5 racial ability modifiers", () => {
    const human = heroBattleStats(createHeroProfile({ id: "h", name: "Human", race: "human", classId: "fighter" }));
    const dwarf = heroBattleStats(createHeroProfile({ id: "d", name: "Dwarf", race: "dwarf", classId: "fighter" }));
    const elf = heroBattleStats(createHeroProfile({ id: "e", name: "Elven", race: "elf", classId: "fighter" }));
    const halfling = heroBattleStats(createHeroProfile({ id: "a", name: "Halfling", race: "halfling", classId: "fighter" }));
    const halfElf = heroBattleStats(createHeroProfile({ id: "he", name: "Half Elf", race: "half-elf", classId: "fighter" }));
    const halfOrc = heroBattleStats(createHeroProfile({ id: "ho", name: "Half Orc", race: "half-orc", classId: "fighter" }));
    expect(human.abilityScores).toMatchObject({ strength: 16, constitution: 16 });
    expect(dwarf.abilityScores).toMatchObject({ constitution: 18, charisma: 8 });
    expect(elf.abilityScores).toMatchObject({ dexterity: 15, constitution: 14 });
    expect(halfling.abilityScores).toMatchObject({ strength: 14, dexterity: 15 });
    expect(halfElf.abilityScores).toEqual(human.abilityScores);
    expect(halfOrc.abilityScores).toMatchObject({ strength: 18, intelligence: 8, charisma: 8 });
  });

  it("offers all six races to every hero class", () => {
    for (const race of ["human", "dwarf", "elf", "halfling", "half-elf", "half-orc"] as const) {
      expect(createHeroProfile({ id: race, name: `Hero ${race}`, race, classId: "sorcerer" }).race).toBe(race);
    }
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
    const novice = createHeroProfile({ id: "novice", name: "Novice", race: "human", classId: "druid" });
    const levelTwo = chooseProgressionOption(awardXp(novice, 250), "talent-vitality");
    const advanced = chooseProgressionOption(levelTwo, "wild-shape");
    const noviceStats = heroBattleStats(novice);
    const advancedStats = heroBattleStats(advanced);
    expect(noviceStats.abilities.map((ability) => ability.id)).toEqual(["entangle", "healing-touch", "thorn-lash"]);
    expect(advancedStats.abilities.map((ability) => ability.id)).toEqual(["entangle", "healing-touch", "thorn-lash", "wild-shape"]);
  });
});
