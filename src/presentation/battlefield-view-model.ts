import type { BattleState, GridPosition, TerrainType } from "../core/domain/types";
import { getReachableCells, positionKey } from "../core/rules/pathfinding";

export interface BattlefieldViewModel {
  width: number;
  height: number;
  cells: Array<{ position: GridPosition; terrain: TerrainType; highlighted: boolean; objectiveHp?: number }>;
  tokens: Array<{ id: string; name: string; position: GridPosition; side: "heroes" | "monsters"; hpRatio: number; active: boolean; dead: boolean }>;
}

export function createBattlefieldViewModel(state: BattleState, showMovement: boolean): BattlefieldViewModel {
  const activeId = state.initiativeOrder[state.activeIndex];
  const reachable = new Set((showMovement ? getReachableCells(state, activeId) : []).map(positionKey));
  return {
    width: state.map.width,
    height: state.map.height,
    cells: state.map.cells.map((cell) => ({ ...cell, highlighted: reachable.has(positionKey(cell.position)), objectiveHp: state.objectives.find((objective) => positionKey(objective.position) === positionKey(cell.position))?.hp })),
    tokens: state.combatants.map((unit) => ({ id: unit.id, name: unit.name, position: unit.position, side: unit.side, hpRatio: unit.hp / unit.maxHp, active: unit.id === activeId, dead: unit.hp <= 0 })),
  };
}

