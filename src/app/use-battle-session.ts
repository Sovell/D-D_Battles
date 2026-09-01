import { useCallback, useEffect, useState } from "react";
import { runAiStep } from "../core/ai/action-scoring";
import type { GridPosition, ScenarioDefinition } from "../core/domain/types";
import { activeCombatant, attackObjective, endActivation, moveCombatant, useAbility, useMovementAbility } from "../core/rules/combat";
import { positionKey } from "../core/rules/pathfinding";
import { createBattle } from "../core/scenario/create-battle";
import { cleanseTheCrypt } from "../core/scenario/scenarios";

export type InteractionMode = { kind: "move" } | { kind: "ability"; abilityId: string } | { kind: "none" };

export function useBattleSession(enabled = true, initialSeed = 3535) {
  const [seed, setSeed] = useState(initialSeed);
  const [state, setState] = useState(() => createBattle(initialSeed, cleanseTheCrypt));
  const [heroIds, setHeroIds] = useState(["fighter", "rogue", "cleric", "wizard"]);
  const [mode, setMode] = useState<InteractionMode>({ kind: "none" });
  const active = activeCombatant(state);
  useEffect(() => {
    if (!enabled || active?.side !== "monsters" || state.outcome !== "active") return;
    const timer = window.setTimeout(() => setState((current) => runAiStep(current)), 360);
    return () => window.clearTimeout(timer);
  }, [active?.id, active?.moved, active?.acted, enabled, state.outcome, state.round]);
  const newExpedition = useCallback((nextSeed: number, scenario: ScenarioDefinition = state.scenario, nextHeroIds: string[] = heroIds) => {
    setSeed(nextSeed);
    setHeroIds(nextHeroIds);
    setState(createBattle(nextSeed, scenario, nextHeroIds));
    setMode({ kind: "none" });
  }, [heroIds, state.scenario]);
  const onCell = useCallback((position: GridPosition) => {
    setState((current) => {
      const actor = activeCombatant(current);
      if (!actor || actor.side !== "heroes" || current.outcome !== "active") return current;
      if (mode.kind === "move") return moveCombatant(current, actor.id, position);
      if (mode.kind === "ability" && actor.abilities.some((ability) => ability.id === mode.abilityId && ability.kind === "move")) return useMovementAbility(current, actor.id, mode.abilityId, position);
      const objective = current.objectives.find((item) => item.hp > 0 && positionKey(item.position) === positionKey(position));
      if (objective && mode.kind === "ability") return attackObjective(current, actor.id, objective.id);
      return current;
    });
    setMode({ kind: "none" });
  }, [mode]);
  const onUnit = useCallback((targetId: string) => {
    if (mode.kind !== "ability") return;
    setState((current) => { const actor = activeCombatant(current); return actor ? useAbility(current, actor.id, mode.abilityId, targetId) : current; });
    setMode({ kind: "none" });
  }, [mode]);
  const finish = useCallback(() => { setState((current) => endActivation(current)); setMode({ kind: "none" }); }, []);
  return { seed, heroIds, state, active, mode, setMode, setSeed, newExpedition, onCell, onUnit, finish };
}
