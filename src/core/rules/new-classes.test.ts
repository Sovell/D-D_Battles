import { describe, expect, it } from "vitest";
import { heroClasses } from "../data/heroes";
import type { BattleState, GridPosition } from "../domain/types";
import { createHeroProfile, heroBattleStats } from "../progression/hero-progression";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt } from "../scenario/scenarios";
import { getLegalTargets, moveCombatant, resolveAbility } from "./combat";

const newClassIds = ["barbarian", "bard", "druid", "monk", "paladin", "ranger", "sorcerer"];

describe("standard hero class expansion", () => {
  it("defines eleven classes and a 3/4/5 ability progression for every newcomer", () => {
    expect(heroClasses.map((heroClass) => heroClass.id)).toEqual(["fighter", "rogue", "cleric", "wizard", ...newClassIds]);
    for (const classId of newClassIds) {
      const heroClass = heroClasses.find((candidate) => candidate.id === classId)!;
      const levelOne = createHeroProfile({ id: classId, name: heroClass.name, race: "human", classId });
      expect(heroClass.abilities).toHaveLength(5);
      expect(levelOne.selectedAbilityIds).toEqual(heroClass.abilities.slice(0, 3).map((ability) => ability.id));
      expect(heroBattleStats(levelOne).abilities).toHaveLength(3);
    }
  });

  it("makes Rage offensive but exposed, and protects against hostile control", () => {
    let state = battleWith("barbarian");
    const barbarian = unit(state, "barbarian");
    state = resolveAbility(state, barbarian.id, "rage", { kind: "self" });
    expect(unit(state, "barbarian").statuses.some((status) => status.id === "raging")).toBe(true);
    const enraged = { ...state, combatants: state.combatants.map((candidate) => candidate.id === barbarian.id ? { ...candidate, acted: false } : candidate) };
    const skeleton = unit(enraged, "skeleton");
    const placed = place(place(enraged, barbarian.id, { x: 3, y: 3 }), skeleton.id, { x: 5, y: 3 });
    const charged = resolveAbility(placed, barbarian.id, "reckless-charge", { kind: "unit", unitId: skeleton.id });
    expect(unit(charged, "barbarian").statuses.some((status) => status.id === "exposed")).toBe(true);

    const attackerReady = { ...state, activeIndex: state.initiativeOrder.indexOf(skeleton.id), combatants: state.combatants.map((candidate) => ({ ...candidate, acted: false })) };
    const close = place(place(boostAttack(attackerReady, skeleton.id), skeleton.id, { x: 3, y: 3 }), barbarian.id, { x: 4, y: 3 });
    const attacked = resolveAbility(close, skeleton.id, "rusted-sword", { kind: "unit", unitId: barbarian.id });
    expect(attacked.log.some((entry) => entry.text.includes("Obronie 14"))).toBe(true);
  });

  it("blocks Druid spells and items during Wild Shape", () => {
    let state = battleWith("druid");
    const druid = unit(state, "druid");
    state = { ...state, combatants: state.combatants.map((candidate) => candidate.id === druid.id ? { ...candidate, abilities: [...candidate.abilities, { id: "item:test", name: "Test Wand", description: "Test", range: 0, resourceCost: 0, target: "self" as const, kind: "status" as const, status: "guarded" as const }] } : candidate) };
    state = resolveAbility(state, druid.id, "wild-shape", { kind: "self" });
    state = { ...state, combatants: state.combatants.map((candidate) => candidate.id === druid.id ? { ...candidate, acted: false } : candidate) };
    expect(getLegalTargets(state, druid.id, "entangle")).toEqual([]);
    expect(getLegalTargets(state, druid.id, "item:test")).toEqual([]);
  });

  it("lets Hunter's Mark improve an ally's attack against the chosen target", () => {
    let state = battleWith("ranger");
    const ranger = unit(state, "ranger");
    const fighter = unit(state, "fighter");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, ranger.id, { x: 2, y: 2 }), skeleton.id, { x: 4, y: 2 });
    state = resolveAbility(state, ranger.id, "hunters-mark", { kind: "unit", unitId: skeleton.id });
    state = { ...state, activeIndex: state.initiativeOrder.indexOf(fighter.id), combatants: state.combatants.map((candidate) => ({ ...candidate, acted: false })) };
    state = place(place(state, fighter.id, { x: 3, y: 2 }), skeleton.id, { x: 4, y: 2 });
    const attack = resolveAbility(state, fighter.id, "longsword", { kind: "unit", unitId: skeleton.id });
    expect(attack.log.some((entry) => entry.text.includes("+ 5"))).toBe(true);
  });

  it("creates Ranger snares that trigger only when an enemy enters", () => {
    let state = battleWith("ranger");
    const ranger = unit(state, "ranger");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, ranger.id, { x: 2, y: 2 }), skeleton.id, { x: 5, y: 2 });
    state = resolveAbility(state, ranger.id, "set-snare", { kind: "cell", position: { x: 4, y: 2 } });
    expect(state.traps).toHaveLength(1);
    const triggered = moveCombatant({ ...state, activeIndex: state.initiativeOrder.indexOf(skeleton.id) }, skeleton.id, { x: 4, y: 2 });
    expect(unit(triggered, "skeleton").statuses.some((status) => status.id === "webbed")).toBe(true);
    expect(triggered.traps).toHaveLength(0);
  });

  it("uses monster tags for Paladin smite and weakens a boss instead of stunning it", () => {
    let paladinBattle = battleWith("paladin");
    const paladin = unit(paladinBattle, "paladin");
    const skeleton = unit(paladinBattle, "skeleton");
    paladinBattle = place(place(boostAttack(paladinBattle, paladin.id), paladin.id, { x: 3, y: 3 }), skeleton.id, { x: 4, y: 3 });
    const ordinaryTarget = { ...paladinBattle, combatants: paladinBattle.combatants.map((candidate) => candidate.id === skeleton.id ? { ...candidate, tags: [] } : candidate) };
    const smitten = resolveAbility(paladinBattle, paladin.id, "smite-evil", { kind: "unit", unitId: skeleton.id });
    const ordinary = resolveAbility(ordinaryTarget, paladin.id, "smite-evil", { kind: "unit", unitId: skeleton.id });
    expect(unit(smitten, "skeleton").hp).toBeLessThan(unit(ordinary, "skeleton").hp);

    let monkBattle = battleWith("monk", ["owlbear"]);
    const monk = unit(monkBattle, "monk");
    const boss = unit(monkBattle, "owlbear");
    monkBattle = place(place(boostAttack(monkBattle, monk.id), monk.id, { x: 3, y: 3 }), boss.id, { x: 4, y: 3 });
    const palm = resolveAbility(monkBattle, monk.id, "quivering-palm", { kind: "unit", unitId: boss.id });
    expect(unit(palm, "owlbear").statuses.some((status) => status.id === "weakened")).toBe(true);
    expect(unit(palm, "owlbear").statuses.some((status) => status.id === "stunned")).toBe(false);
  });

  it("uses Monk's Deflect Projectiles once per round", () => {
    let state = battleWith("monk", ["manticore"]);
    const monk = unit(state, "monk");
    state = resolveAbility(state, monk.id, "deflect-projectiles", { kind: "self" });
    const manticore = unit(state, "manticore");
    state = { ...state, activeIndex: state.initiativeOrder.indexOf(manticore.id), combatants: state.combatants.map((candidate) => ({ ...candidate, acted: false })) };
    state = place(place(boostAttack(state, manticore.id), manticore.id, { x: 2, y: 2 }), monk.id, { x: 5, y: 2 });
    const withoutDeflect = { ...state, combatants: state.combatants.map((candidate) => candidate.id === monk.id ? { ...candidate, statuses: candidate.statuses.filter((status) => status.id !== "deflecting") } : candidate) };
    const defended = resolveAbility(state, manticore.id, "tail-spike", { kind: "unit", unitId: monk.id });
    const baseline = resolveAbility(withoutDeflect, manticore.id, "tail-spike", { kind: "unit", unitId: monk.id });
    expect(unit(defended, "monk").hp).toBeGreaterThan(unit(baseline, "monk").hp);
    expect(unit(defended, "monk").reactionUsedRound).toBe(state.round);
  });

  it("shows and spends Sorcerer Arcane Surge while respecting cooldowns", () => {
    let state = battleWith("sorcerer");
    const sorcerer = unit(state, "sorcerer");
    state = place(state, sorcerer.id, { x: 2, y: 2 });
    const skeleton = unit(state, "skeleton");
    state = place(state, skeleton.id, { x: 4, y: 2 });
    const used = resolveAbility(state, sorcerer.id, "sorcerer-burning-hands", { kind: "cell", position: { x: 4, y: 2 } });
    expect(unit(used, "sorcerer")).toMatchObject({ maxCharges: 6, charges: 5 });
    expect(getLegalTargets({ ...used, round: 2, combatants: used.combatants.map((candidate) => candidate.id === sorcerer.id ? { ...candidate, acted: false } : candidate) }, sorcerer.id, "sorcerer-burning-hands")).toEqual([]);
  });
});

function battleWith(classId: string, monsters = ["skeleton"]): BattleState {
  const heroes = [classId, "fighter", "cleric"].map((id, index) => {
    const profile = createHeroProfile({ id: `${id}-${index}`, name: `${id} hero`, race: "human", classId: id });
    const definition = heroClasses.find((candidate) => candidate.id === id)!;
    return index === 0 ? { ...profile, level: 5, xp: 700, selectedAbilityIds: definition.abilities.map((ability) => ability.id) } : profile;
  });
  const scenario = { ...cleanseTheCrypt, encounter: { ...cleanseTheCrypt.encounter, monsters } };
  const state = createBattle(919, scenario, heroes);
  const active = unit(state, classId);
  return { ...state, activeIndex: state.initiativeOrder.indexOf(active.id), map: { ...state.map, cells: state.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) }, combatants: state.combatants.map((candidate, index) => ({ ...candidate, position: { x: 1 + index * 2, y: 10 }, acted: false, moved: false })) };
}

function unit(state: BattleState, definitionId: string) { return state.combatants.find((candidate) => candidate.definitionId === definitionId)!; }
function place(state: BattleState, id: string, position: GridPosition): BattleState { return { ...state, combatants: state.combatants.map((candidate) => candidate.id === id ? { ...candidate, position } : candidate) }; }
function boostAttack(state: BattleState, id: string): BattleState { return { ...state, combatants: state.combatants.map((candidate) => candidate.id === id ? { ...candidate, attackBonus: 99, basicAttack: { ...candidate.basicAttack, attackBonusOverride: 99 }, abilities: candidate.abilities.map((ability) => ability.kind === "attack" ? { ...ability, attackBonusOverride: 99 } : ability) } : candidate) }; }
