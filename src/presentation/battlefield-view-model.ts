import type { BattleState, GridPosition, TerrainType } from "../core/domain/types";
import { canTargetWithAbility } from "../core/rules/combat";
import { distance, getReachableCells, positionKey } from "../core/rules/pathfinding";

export interface BattlefieldViewModel {
  width: number;
  height: number;
  cells: Array<{ position: GridPosition; terrain: TerrainType; highlight: "movement" | "ability" | null; objectiveHp?: number }>;
  tokens: Array<{ id: string; name: string; position: GridPosition; side: "heroes" | "monsters"; hpRatio: number; active: boolean; selected: boolean; dead: boolean; targetable: boolean }>;
}

export function createBattlefieldViewModel(state: BattleState, showMovement: boolean, abilityId?: string, selectedUnitId?: string): BattlefieldViewModel {
  const activeId = state.initiativeOrder[state.activeIndex];
  const active = state.combatants.find((unit) => unit.id === activeId);
  const ability = active && [active.basicAttack, ...active.abilities].find((candidate) => candidate.id === abilityId);
  const reachable = new Set((showMovement ? getReachableCells(state, activeId) : []).map(positionKey));
  const abilityCells = new Set(ability && active ? state.map.cells.filter((cell) => cell.terrain !== "wall" && distance(active.position, cell.position) <= ability.range).map((cell) => positionKey(cell.position)) : []);
  return {
    width: state.map.width,
    height: state.map.height,
    cells: state.map.cells.map((cell) => ({ ...cell, highlight: reachable.has(positionKey(cell.position)) ? "movement" : abilityCells.has(positionKey(cell.position)) ? "ability" : null, objectiveHp: state.objectives.find((objective) => positionKey(objective.position) === positionKey(cell.position))?.hp })),
    tokens: state.combatants.map((unit) => ({ id: unit.id, name: unit.name, position: unit.position, side: unit.side, hpRatio: unit.hp / unit.maxHp, active: unit.id === activeId, selected: unit.id === selectedUnitId, dead: unit.hp <= 0, targetable: Boolean(abilityId && canTargetWithAbility(state, activeId, abilityId, unit.id)) })),
  };
}
