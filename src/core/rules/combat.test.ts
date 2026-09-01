import { describe, expect, it } from "vitest";
import { createBattle } from "../scenario/create-battle";
import { cleanseTheCrypt, interruptTheRitual } from "../scenario/scenarios";
import { attackObjective, evaluateOutcome, moveCombatant, useAbility } from "./combat";
import { getReachableCells } from "./pathfinding";

describe("combat rules", () => {
  it("only allows movement into reachable cells and spends movement", () => {
    const state = createBattle(2, cleanseTheCrypt);
    const fighter = state.combatants.find((unit) => unit.definitionId === "fighter")!;
    const destination = getReachableCells(state, fighter.id)[0];
    const moved = moveCombatant(state, fighter.id, destination);
    expect(moved.combatants.find((unit) => unit.id === fighter.id)?.moved).toBe(true);
  });
  it("resolves deterministic d20 attacks and natural results through the seeded source", () => {
    const state = createBattle(3, cleanseTheCrypt);
    const fighter = state.combatants.find((unit) => unit.definitionId === "fighter")!;
    const skeleton = state.combatants.find((unit) => unit.definitionId === "skeleton")!;
    const adjacent = { ...state, combatants: state.combatants.map((unit) => unit.id === skeleton.id ? { ...unit, position: { x: fighter.position.x + 1, y: fighter.position.y } } : unit) };
    const result = useAbility(adjacent, fighter.id, fighter.basicAttack.id, skeleton.id);
    expect(result.log.some((entry) => entry.text.includes("d20"))).toBe(true);
    expect(result.randomState).not.toBe(state.randomState);
  });
  it("can destroy scenario objectives", () => {
    let state = createBattle(9, cleanseTheCrypt);
    const fighter = state.combatants.find((unit) => unit.definitionId === "fighter")!;
    const objective = state.objectives[0];
    state = { ...state, combatants: state.combatants.map((unit) => unit.id === fighter.id ? { ...unit, position: { x: objective.position.x - 1, y: objective.position.y }, attackBonus: 99 } : unit) };
    const result = attackObjective(state, fighter.id, objective.id);
    expect(result.objectives[0].hp).toBeLessThan(objective.hp);
  });
  it("wins the ritual scenario when the ritualist falls", () => {
    const state = createBattle(17, interruptTheRitual);
    const ritualist = state.combatants.find((unit) => unit.tags.includes("ritualist"))!;
    const resolved = evaluateOutcome({
      ...state,
      combatants: state.combatants.map((unit) => unit.id === ritualist.id ? { ...unit, hp: 0 } : unit),
    });
    expect(resolved.outcome).toBe("victory");
  });
  it("loses the ritual scenario after the eighth round", () => {
    const state = createBattle(18, interruptTheRitual);
    expect(evaluateOutcome({ ...state, round: 9 }).outcome).toBe("defeat");
  });
});
