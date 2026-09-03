import type { BattleState, GridPosition, ScenarioCondition, TerrainType } from "../core/domain/types";
import { getLegalTargets } from "../core/rules/combat";
import { hasLineOfSight } from "../core/rules/line-of-sight";
import { distance, getReachableCells, positionKey } from "../core/rules/pathfinding";

export interface BattlefieldViewModel {
  width: number;
  height: number;
  cells: Array<{ position: GridPosition; terrain: TerrainType; highlight: "movement" | "ability" | "area" | null; targetable: boolean; objectiveHp?: number; exitZone: boolean }>;
  tokens: Array<{ id: string; definitionId: string; artVariant: number; name: string; position: GridPosition; side: "heroes" | "monsters"; hpRatio: number; active: boolean; selected: boolean; dead: boolean; targetable: boolean }>;
}

export function createBattlefieldViewModel(state: BattleState, showMovement: boolean, abilityId?: string, selectedUnitId?: string, hoveredCell?: GridPosition): BattlefieldViewModel {
  const activeId = state.initiativeOrder[state.activeIndex];
  const active = state.combatants.find((unit) => unit.id === activeId);
  const ability = active && [active.basicAttack, ...active.abilities].find((candidate) => candidate.id === abilityId);
  const legalTargets = abilityId ? getLegalTargets(state, activeId, abilityId) : [];
  const legalCells = new Set(legalTargets.filter((target) => target.kind === "cell").map((target) => positionKey(target.position)));
  const legalUnits = new Set(legalTargets.flatMap((target) => target.kind === "unit" ? [target.unitId] : target.kind === "self" ? [activeId] : []));
  const legalObjectives = new Set(legalTargets.filter((target) => target.kind === "objective").map((target) => target.objectiveId));
  const reachable = new Set((showMovement ? getReachableCells(state, activeId) : []).map(positionKey));
  const hoveredIsLegal = hoveredCell && legalCells.has(positionKey(hoveredCell));
  const areaCells = new Set(hoveredIsLegal && ability?.area ? state.map.cells.filter((cell) => cell.terrain !== "wall" && distance(hoveredCell, cell.position) <= ability.area! && hasLineOfSight(state.map, hoveredCell, cell.position)).map((cell) => positionKey(cell.position)) : []);
  const exit = findExitZone(state.scenario.victoryRules);

  return {
    width: state.map.width,
    height: state.map.height,
    cells: state.map.cells.map((cell) => {
      const objective = state.objectives.find((item) => positionKey(item.position) === positionKey(cell.position));
      const targetable = legalCells.has(positionKey(cell.position)) || Boolean(objective && legalObjectives.has(objective.id));
      const highlight = reachable.has(positionKey(cell.position)) ? "movement" : areaCells.has(positionKey(cell.position)) ? "area" : targetable ? "ability" : null;
      return { ...cell, highlight, targetable, objectiveHp: objective?.hp, exitZone: Boolean(exit && cell.terrain !== "wall" && distance(cell.position, exit.center) <= exit.radius) };
    }),
    tokens: state.combatants.map((unit) => ({ id: unit.id, definitionId: unit.definitionId, artVariant: unit.artVariant ?? 0, name: unit.name, position: unit.position, side: unit.side, hpRatio: unit.hp / unit.maxHp, active: unit.id === activeId, selected: unit.id === selectedUnitId, dead: unit.hp <= 0, targetable: legalUnits.has(unit.id) })),
  };
}

function findExitZone(condition?: ScenarioCondition): Extract<ScenarioCondition, { type: "side-in-zone" }> | undefined {
  if (!condition) return undefined;
  if (condition.type === "side-in-zone" && condition.side === "heroes") return condition;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.map(findExitZone).find(Boolean);
}
