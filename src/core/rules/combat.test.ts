import { describe, expect, it } from "vitest";
import type { BattleState, GridPosition, TerrainType } from "../domain/types";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt, interruptTheRitual } from "../scenario/scenarios";
import { endActivation, evaluateOutcome, getLegalTargets, isFlanking, moveCombatant, resolveAbility } from "./combat";
import { getReachableCells, positionKey } from "./pathfinding";

describe("combat rules", () => {
  it("only allows movement into reachable cells and spends movement", () => {
    const state = createBattle(2, cleanseTheCrypt);
    const fighter = state.combatants.find((unit) => unit.definitionId === "fighter")!;
    const destination = getReachableCells(state, fighter.id)[0];
    const moved = moveCombatant(state, fighter.id, destination);
    expect(moved.combatants.find((unit) => unit.id === fighter.id)?.moved).toBe(true);
  });

  it("returns legal Self, Unit, Cell and Objective targets", () => {
    let state = openBattle(31, "fighter");
    const fighter = unit(state, "fighter");
    const objective = state.objectives[0];
    state = place(state, fighter.id, { x: objective.position.x - 1, y: objective.position.y });
    expect(getLegalTargets(state, fighter.id, "guard")).toContainEqual({ kind: "self" });
    expect(getLegalTargets(state, fighter.id, "longsword")).toContainEqual({ kind: "objective", objectiveId: objective.id });

    state = activate(state, "cleric");
    const cleric = unit(state, "cleric");
    state = place(place(state, cleric.id, { x: 2, y: 2 }), fighter.id, { x: 4, y: 2 });
    expect(getLegalTargets(state, cleric.id, "healing-word")).toContainEqual({ kind: "unit", unitId: fighter.id });

    state = activate(state, "wizard");
    const wizard = unit(state, "wizard");
    state = place(state, wizard.id, { x: 2, y: 2 });
    expect(getLegalTargets(state, wizard.id, "web")).toContainEqual({ kind: "cell", position: { x: 4, y: 2 } });
  });

  it("damages an objective through the same ability resolver", () => {
    let state = openBattle(41, "fighter");
    const fighter = unit(state, "fighter");
    const objective = state.objectives[0];
    state = place(boostAttack(state, fighter.id), fighter.id, { x: objective.position.x - 1, y: objective.position.y });
    const resolved = resolveAbility(state, fighter.id, "longsword", { kind: "objective", objectiveId: objective.id });
    expect(resolved.objectives[0].hp).toBeLessThan(objective.hp);
  });

  it("resolves Web on an empty cell and Burning Hands from the selected cell", () => {
    let state = openBattle(32, "wizard");
    const wizard = unit(state, "wizard");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, wizard.id, { x: 2, y: 2 }), skeleton.id, { x: 5, y: 2 });
    const empty = { x: 4, y: 2 };
    const webbed = resolveAbility(state, wizard.id, "web", { kind: "cell", position: empty });
    expect(webbed.combatants.find((candidate) => candidate.id === wizard.id)?.acted).toBe(true);
    expect(webbed.log.at(-1)?.text).toMatch(/Web|webbed/);

    state = { ...state, randomState: 100, combatants: state.combatants.map((candidate) => candidate.id === wizard.id ? { ...candidate, acted: false, charges: 3, cooldowns: {} } : candidate) };
    const burned = resolveAbility(state, wizard.id, "burning-hands", { kind: "cell", position: empty });
    expect(burned.combatants.find((candidate) => candidate.id === skeleton.id)!.hp).toBeLessThan(skeleton.hp);
  });

  it("blocks ranged targets behind walls and grants cover only against ranged attacks", () => {
    let state = openBattle(33, "wizard");
    const wizard = unit(state, "wizard");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, wizard.id, { x: 2, y: 2 }), skeleton.id, { x: 6, y: 2 });
    state = setTerrain(state, { x: 4, y: 2 }, "wall");
    expect(getLegalTargets(state, wizard.id, "fire-bolt")).not.toContainEqual({ kind: "unit", unitId: skeleton.id });

    state = setTerrain(state, { x: 4, y: 2 }, "floor");
    state = setTerrain(state, { x: 6, y: 2 }, "cover");
    state = boostAttack(state, wizard.id);
    const result = resolveAbility(state, wizard.id, "fire-bolt", { kind: "unit", unitId: skeleton.id });
    expect(result.log.some((entry) => entry.text.includes("Obronie 17"))).toBe(true);

    state = openBattle(42, "fighter");
    const fighter = unit(state, "fighter");
    const meleeTarget = unit(state, "skeleton");
    state = place(place(boostAttack(state, fighter.id), fighter.id, { x: 5, y: 2 }), meleeTarget.id, { x: 6, y: 2 });
    state = setTerrain(state, { x: 6, y: 2 }, "cover");
    const melee = resolveAbility(state, fighter.id, "longsword", { kind: "unit", unitId: meleeTarget.id });
    expect(melee.log.some((entry) => entry.text.includes("Obronie 15"))).toBe(true);
  });

  it("requires a true opposite-side flank for Sneak Attack", () => {
    let state = openBattle(34, "rogue");
    const rogue = unit(state, "rogue");
    const fighter = unit(state, "fighter");
    const skeleton = unit(state, "skeleton");
    state = place(place(place(state, rogue.id, { x: 4, y: 5 }), skeleton.id, { x: 5, y: 5 }), fighter.id, { x: 6, y: 5 });
    expect(isFlanking(state, rogue.id, skeleton.id)).toBe(true);
    expect(getLegalTargets(state, rogue.id, "sneak-attack")).toContainEqual({ kind: "unit", unitId: skeleton.id });
    state = place(state, fighter.id, { x: 6, y: 6 });
    expect(getLegalTargets(state, rogue.id, "sneak-attack")).not.toContainEqual({ kind: "unit", unitId: skeleton.id });
  });

  it("applies high ground, hazard and Ogre knockback", () => {
    let state = openBattle(35, "wizard");
    const wizard = unit(state, "wizard");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, wizard.id, { x: 2, y: 2 }), skeleton.id, { x: 4, y: 2 });
    state = setTerrain(boostAttack(state, wizard.id), { x: 2, y: 2 }, "highGround");
    const elevated = resolveAbility(state, wizard.id, "fire-bolt", { kind: "unit", unitId: skeleton.id });
    expect(elevated.log.some((entry) => entry.text.includes("+ 100"))).toBe(true);

    state = openBattle(36, "fighter");
    const fighter = unit(state, "fighter");
    const rogue = unit(state, "rogue");
    state = { ...state, initiativeOrder: [fighter.id, rogue.id, ...state.initiativeOrder.filter((id) => id !== fighter.id && id !== rogue.id)], activeIndex: 0 };
    state = setTerrain(place(state, rogue.id, { x: 4, y: 4 }), { x: 4, y: 4 }, "hazard");
    expect(endActivation(state).combatants.find((candidate) => candidate.id === rogue.id)?.hp).toBe(rogue.hp - 2);

    state = openBattle(37, "ogre", ["fighter", "rogue", "cleric"]);
    const ogre = unit(state, "ogre");
    const pushedFighter = unit(state, "fighter");
    state = place(place(boostAttack(state, ogre.id), ogre.id, { x: 4, y: 5 }), pushedFighter.id, { x: 5, y: 5 });
    const knocked = resolveAbility(state, ogre.id, "greatclub", { kind: "unit", unitId: pushedFighter.id });
    expect(knocked.combatants.find((candidate) => candidate.id === pushedFighter.id)?.position).toEqual({ x: 6, y: 5 });
  });

  it("implements Armored Vanguard and Beacon of Faith", () => {
    let state = openBattle(38, "goblin");
    const goblin = unit(state, "goblin");
    const fighter = unit(state, "fighter");
    const rogue = unit(state, "rogue");
    state = place(place(place(boostAttack(state, goblin.id), goblin.id, { x: 3, y: 3 }), fighter.id, { x: 4, y: 3 }), rogue.id, { x: 5, y: 3 });
    const attack = resolveAbility(state, goblin.id, "scimitar", { kind: "unit", unitId: fighter.id });
    expect(attack.log.some((entry) => entry.text.includes(`Obronie ${fighter.defenseClass + 1}`))).toBe(true);

    state = openBattle(39, "cleric");
    const cleric = unit(state, "cleric");
    const wounded = unit(state, "fighter");
    state = place(place(state, cleric.id, { x: 2, y: 2 }), wounded.id, { x: 3, y: 2 });
    state = { ...state, combatants: state.combatants.map((candidate) => candidate.id === wounded.id ? { ...candidate, hp: 10 } : candidate) };
    const healed = resolveAbility(state, cleric.id, "healing-word", { kind: "unit", unitId: wounded.id });
    expect(healed.log.some((entry) => entry.text.includes("Beacon of Faith +2"))).toBe(true);
  });

  it("keeps charged abilities on cooldown for the next round", () => {
    let state = openBattle(40, "wizard");
    const wizard = unit(state, "wizard");
    const skeleton = unit(state, "skeleton");
    state = place(place(state, wizard.id, { x: 1, y: 1 }), skeleton.id, { x: 2, y: 1 });
    const used = resolveAbility(state, wizard.id, "magic-missile", { kind: "unit", unitId: skeleton.id });
    const nextRound = { ...used, round: 2, combatants: used.combatants.map((candidate) => candidate.id === wizard.id ? { ...candidate, acted: false } : candidate) };
    expect(getLegalTargets(nextRound, wizard.id, "magic-missile")).toEqual([]);
    expect(getLegalTargets({ ...nextRound, round: 3 }, wizard.id, "magic-missile")).toContainEqual({ kind: "unit", unitId: skeleton.id });
  });

  it("wins and loses ritual scenarios by their explicit conditions", () => {
    const state = createBattle(17, interruptTheRitual);
    const ritualist = state.combatants.find((candidate) => candidate.tags.includes("ritualist"))!;
    expect(evaluateOutcome({ ...state, combatants: state.combatants.map((candidate) => candidate.id === ritualist.id ? { ...candidate, hp: 0 } : candidate) }).outcome).toBe("victory");
    expect(evaluateOutcome({ ...state, round: 9 }).outcome).toBe("defeat");
  });
});

function openBattle(seed: number, activeDefinitionId: string, heroIds?: string[]): BattleState {
  const scenario = activeDefinitionId === "ogre"
    ? { ...cleanseTheCrypt, encounter: { ...cleanseTheCrypt.encounter, monsters: ["ogre", "skeleton", "ghoul", "goblin"] } }
    : cleanseTheCrypt;
  const state = createBattle(seed, scenario, heroIds);
  return activate({ ...state, map: { ...state.map, cells: state.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) }, combatants: state.combatants.map((candidate, index) => ({ ...candidate, position: { x: 1 + index * 2, y: 10 } })) }, activeDefinitionId);
}

function activate(state: BattleState, definitionId: string): BattleState {
  const active = unit(state, definitionId);
  return { ...state, activeIndex: state.initiativeOrder.indexOf(active.id), combatants: state.combatants.map((candidate) => ({ ...candidate, acted: false, moved: false })) };
}

function unit(state: BattleState, definitionId: string) {
  return state.combatants.find((candidate) => candidate.definitionId === definitionId)!;
}

function place(state: BattleState, id: string, position: GridPosition): BattleState {
  return { ...state, combatants: state.combatants.map((candidate) => candidate.id === id ? { ...candidate, position } : candidate) };
}

function setTerrain(state: BattleState, position: GridPosition, terrain: TerrainType): BattleState {
  return { ...state, map: { ...state.map, cells: state.map.cells.map((cell) => positionKey(cell.position) === positionKey(position) ? { ...cell, terrain } : cell) } };
}

function boostAttack(state: BattleState, id: string): BattleState {
  return { ...state, combatants: state.combatants.map((candidate) => candidate.id === id ? { ...candidate, attackBonus: 99, basicAttack: { ...candidate.basicAttack, attackBonusOverride: 99 }, abilities: candidate.abilities.map((ability) => ability.kind === "attack" ? { ...ability, attackBonusOverride: 99 } : ability) } : candidate) };
}
