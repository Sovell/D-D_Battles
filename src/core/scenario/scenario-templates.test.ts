import { describe, expect, it } from "vitest";
import { monsters } from "../data/monsters";
import { chooseAiAction } from "../ai/action-scoring";
import type { BattleState, ScenarioTemplateId } from "../domain/types";
import { generateScenarioMap } from "../map-generation/scenario-map";
import { createLegacyRoster } from "../progression/hero-progression";
import { evaluateOutcome } from "../rules/combat";
import { createBattle } from "./create-battle";
import { buildScenarioTemplate, scenarioTemplates } from "./scenario-templates";

const requestedMonsters = ["orc-brute", "bugbear-ambusher", "zombie", "hobgoblin-captain", "worg", "dire-wolf", "harpy", "minotaur", "troll", "manticore", "wraith", "young-dragon"];

describe("extended monster roster", () => {
  it("defines every requested monster with an AI role, tier and tactical counter", () => {
    for (const id of requestedMonsters) {
      const monster = monsters.find((candidate) => candidate.id === id);
      expect(monster).toBeDefined();
      expect(monster?.doctrine).toBeTruthy();
      expect(monster?.tier).toBeGreaterThanOrEqual(1);
      expect(monster?.tacticalCounter.length).toBeGreaterThan(20);
      expect([monster?.basicAttack, ...(monster?.abilities ?? [])].every((ability) => ability?.name && ability?.description)).toBe(true);
    }
  });

  it("lets AI select a new area ability when it has valuable legal targets", () => {
    const base = battleFor("skirmish");
    const dragon = monsters.find((monster) => monster.id === "young-dragon")!;
    const actor = { ...base.combatants.find((unit) => unit.side === "monsters")!, definitionId: dragon.id, name: dragon.name, position: { x: 5, y: 5 }, basicAttack: dragon.basicAttack, abilities: dragon.abilities, doctrine: dragon.doctrine };
    const heroes = base.combatants.filter((unit) => unit.side === "heroes");
    const combatants = base.combatants.map((unit, index) => unit.id === actor.id ? actor : unit.side === "heroes" ? { ...unit, position: [{ x: 7, y: 5 }, { x: 7, y: 6 }, { x: 8, y: 5 }][heroes.findIndex((hero) => hero.id === unit.id)] } : { ...unit, hp: 0 });
    const state = { ...base, map: { ...base.map, cells: base.map.cells.map((cell) => ({ ...cell, terrain: "floor" as const })) }, combatants, initiativeOrder: [actor.id, ...base.initiativeOrder.filter((id) => id !== actor.id)], activeIndex: 0 };
    expect(chooseAiAction(state)).toMatchObject({ kind: "attack", abilityId: "fire-breath" });
  });
});

describe("scenario templates", () => {
  it("defines all eight templates with setup, events, levels and XP", () => {
    expect(scenarioTemplates.map((template) => template.id)).toEqual(["skirmish", "hold-the-line", "breakthrough", "assassinate", "rescue", "ritual-disruption", "escape", "treasure-run"]);
    for (const template of scenarioTemplates) {
      expect(template.objectiveText).toBeTruthy();
      expect(template.failureText).toBeTruthy();
      expect(template.events.length).toBeGreaterThan(0);
      expect(template.monsters.length).toBeGreaterThan(0);
      expect(template.suggestedLevel.max).toBeGreaterThanOrEqual(template.suggestedLevel.min);
      expect(template.rewardXp).toBeGreaterThan(0);
    }
  });

  it.each<ScenarioTemplateId>(["skirmish", "hold-the-line", "breakthrough", "assassinate", "rescue", "ritual-disruption", "escape", "treasure-run"])("resolves the victory condition for %s", (id) => {
    const state = battleFor(id);
    expect(evaluateOutcome(makeVictorious(state, id)).outcome).toBe("victory");
  });

  it.each<ScenarioTemplateId>(["breakthrough", "assassinate", "rescue", "ritual-disruption", "escape", "treasure-run"])("enforces the round limit for %s", (id) => {
    const state = battleFor(id);
    expect(evaluateOutcome({ ...state, round: (state.scenario.roundLimit ?? 0) + 1 }).outcome).toBe("defeat");
  });
});

function battleFor(id: ScenarioTemplateId): BattleState {
  const template = scenarioTemplates.find((candidate) => candidate.id === id)!;
  const map = generateScenarioMap(6100 + scenarioTemplates.indexOf(template), template.environment, template.requiresObjectives);
  return createBattle(map.seed, buildScenarioTemplate(id, map), createLegacyRoster().slice(0, 3));
}

function makeVictorious(state: BattleState, id: ScenarioTemplateId): BattleState {
  if (id === "skirmish") return { ...state, combatants: state.combatants.map((unit) => unit.side === "monsters" ? { ...unit, hp: 0 } : unit) };
  if (id === "hold-the-line") return { ...state, round: 7 };
  if (id === "assassinate" || id === "ritual-disruption") {
    const target = id === "assassinate" ? "hobgoblin-captain" : "ritualist";
    return { ...state, combatants: state.combatants.map((unit) => unit.definitionId === target ? { ...unit, hp: 0 } : unit) };
  }
  if (id === "rescue") return { ...state, objectives: state.objectives.map((objective) => ({ ...objective, hp: 0 })) };
  const zone = findZone(state.scenario.victoryRules!);
  const zoneCells = [zone.center, { x: zone.center.x - 1, y: zone.center.y }, { x: zone.center.x, y: zone.center.y - 1 }, { x: zone.center.x + 1, y: zone.center.y }];
  return {
    ...state,
    objectives: id === "treasure-run" ? state.objectives.map((objective) => ({ ...objective, hp: 0 })) : state.objectives,
    combatants: state.combatants.map((unit, index) => unit.side === "heroes" && (id === "escape" || index === 0) ? { ...unit, position: zoneCells[index] } : unit),
  };
}

function findZone(condition: NonNullable<BattleState["scenario"]["victoryRules"]>): Extract<typeof condition, { type: "side-in-zone" }> {
  if (condition.type === "side-in-zone") return condition;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.find((item) => item.type === "side-in-zone") as Extract<typeof condition, { type: "side-in-zone" }>;
  throw new Error("Template has no extraction zone");
}
