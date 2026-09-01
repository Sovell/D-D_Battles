import { describe, expect, it } from "vitest";
import { createBattle } from "../core/scenario/create-battle";
import { cleanseTheCrypt } from "../core/scenario/scenarios";
import { createBattlefieldViewModel } from "./battlefield-view-model";

describe("battlefield ability range", () => {
  it("marks only legal unit targets", () => {
    const base = createBattle(33, cleanseTheCrypt);
    const wizard = base.combatants.find((unit) => unit.definitionId === "wizard")!;
    const skeleton = base.combatants.find((unit) => unit.definitionId === "skeleton")!;
    const ghoul = base.combatants.find((unit) => unit.definitionId === "ghoul")!;
    const state = {
      ...base,
      map: { ...base.map, cells: base.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) },
      activeIndex: base.initiativeOrder.indexOf(wizard.id),
      combatants: base.combatants.map((unit) => unit.id === wizard.id ? { ...unit, position: { x: 1, y: 1 } } : unit.id === skeleton.id ? { ...unit, position: { x: 8, y: 1 } } : unit.id === ghoul.id ? { ...unit, position: { x: 9, y: 1 } } : unit),
    };
    const model = createBattlefieldViewModel(state, false, "magic-missile", skeleton.id);
    expect(model.tokens.find((token) => token.id === skeleton.id)?.targetable).toBe(true);
    expect(model.tokens.find((token) => token.id === ghoul.id)?.targetable).toBe(false);
    expect(model.tokens.find((token) => token.id === skeleton.id)?.selected).toBe(true);
    expect(model.cells.some((cell) => cell.highlight === "ability")).toBe(false);
  });

  it("shows legal cell targets and the area around the hovered target", () => {
    const base = createBattle(34, cleanseTheCrypt);
    const wizard = base.combatants.find((unit) => unit.definitionId === "wizard")!;
    const state = {
      ...base,
      map: { ...base.map, cells: base.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) },
      activeIndex: base.initiativeOrder.indexOf(wizard.id),
      combatants: base.combatants.map((unit) => unit.id === wizard.id ? { ...unit, position: { x: 1, y: 1 } } : unit),
    };
    const hovered = { x: 4, y: 1 };
    const model = createBattlefieldViewModel(state, false, "web", undefined, hovered);
    expect(model.cells.find((cell) => cell.position.x === 4 && cell.position.y === 1)?.targetable).toBe(true);
    expect(model.cells.find((cell) => cell.position.x === 4 && cell.position.y === 2)?.highlight).toBe("area");
    expect(model.cells.find((cell) => cell.position.x === 6 && cell.position.y === 1)?.highlight).toBe("ability");
  });
});
