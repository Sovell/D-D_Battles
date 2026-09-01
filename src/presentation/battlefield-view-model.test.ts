import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { cleanseTheCrypt } from "../core/scenario/scenarios";
import { distance } from "../core/rules/pathfinding";
import { createBattlefieldViewModel } from "./battlefield-view-model";

describe("battlefield ability range", () => {
  it("highlights ability range and only marks legal targets", () => {
    const base = createBattle(33, cleanseTheCrypt);
    const wizard = base.combatants.find((unit) => unit.definitionId === "wizard")!;
    const skeleton = base.combatants.find((unit) => unit.definitionId === "skeleton")!;
    const ghoul = base.combatants.find((unit) => unit.definitionId === "ghoul")!;
    const state = {
      ...base,
      activeIndex: base.initiativeOrder.indexOf(wizard.id),
      combatants: base.combatants.map((unit) => unit.id === wizard.id ? { ...unit, position: { x: 1, y: 1 } } : unit.id === skeleton.id ? { ...unit, position: { x: 8, y: 1 } } : unit.id === ghoul.id ? { ...unit, position: { x: 9, y: 1 } } : unit),
    };
    const model = createBattlefieldViewModel(state, false, "magic-missile", skeleton.id);
    expect(model.tokens.find((token) => token.id === skeleton.id)?.targetable).toBe(true);
    expect(model.tokens.find((token) => token.id === ghoul.id)?.targetable).toBe(false);
    expect(model.tokens.find((token) => token.id === skeleton.id)?.selected).toBe(true);
    expect(model.cells.filter((cell) => cell.highlight === "ability").every((cell) => distance({ x: 1, y: 1 }, cell.position) <= 7)).toBe(true);
  });
});
