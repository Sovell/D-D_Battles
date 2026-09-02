import { useCallback, useEffect, useState } from "react";
import { runAiStep } from "../core/ai/action-scoring";
import type { GridPosition, ScenarioDefinition } from "../core/domain/types";
import { activeCombatant, endActivation, getLegalTargets, moveCombatant, resolveAbility } from "../core/rules/combat";
import { createBattle } from "../core/scenario/create-battle";
import { cleanseTheCrypt } from "../core/scenario/scenarios";
import { dismissScenarioEventNotice } from "../core/scenario/scenario-events";
import { loadBattleSession, saveBattleSession, type SavedBattleSession } from "./session-storage";

export type InteractionMode = { kind: "move" } | { kind: "ability"; abilityId: string } | { kind: "none" };

export function useBattleSession(enabled = true, initialSeed = 3535) {
  const [restored] = useState(() => loadBattleSession());
  const [seed, setSeed] = useState(restored?.seed ?? initialSeed);
  const [state, setState] = useState(() => restored?.state ?? createBattle(initialSeed, cleanseTheCrypt));
  const [heroIds, setHeroIds] = useState(restored?.heroIds ?? ["fighter", "rogue", "cleric", "wizard"]);
  const [hasSavedSession, setHasSavedSession] = useState(Boolean(restored));
  const [mode, setMode] = useState<InteractionMode>({ kind: "none" });
  const active = activeCombatant(state);
  useEffect(() => {
    if (!enabled || active?.side !== "monsters" || state.outcome !== "active" || (state.pendingEventNotices?.length ?? 0) > 0) return;
    const timer = window.setTimeout(() => setState((current) => runAiStep(current)), 360);
    return () => window.clearTimeout(timer);
  }, [active?.id, active?.moved, active?.acted, enabled, state.outcome, state.round]);
  useEffect(() => {
    if (hasSavedSession) saveBattleSession(seed, heroIds, state);
  }, [hasSavedSession, heroIds, seed, state]);
  const newExpedition = useCallback((nextSeed: number, scenario: ScenarioDefinition = state.scenario, nextHeroIds: string[] = heroIds, nextHeroVariants: Record<string, number> = Object.fromEntries(state.combatants.filter((unit) => unit.side === "heroes").map((unit) => [unit.definitionId, unit.artVariant ?? 0]))) => {
    setSeed(nextSeed);
    setHeroIds(nextHeroIds);
    setState(createBattle(nextSeed, scenario, nextHeroIds, nextHeroVariants));
    setHasSavedSession(true);
    setMode({ kind: "none" });
  }, [heroIds, state.combatants, state.scenario]);
  const loadExpedition = useCallback((saved: SavedBattleSession) => {
    setSeed(saved.seed);
    setHeroIds([...saved.heroIds]);
    setState(saved.state);
    setHasSavedSession(true);
    setMode({ kind: "none" });
  }, []);
  const onCell = useCallback((position: GridPosition) => {
    setState((current) => {
      const actor = activeCombatant(current);
      if (!actor || actor.side !== "heroes" || current.outcome !== "active") return current;
      if (mode.kind === "move") return moveCombatant(current, actor.id, position);
      if (mode.kind === "ability") {
        const legalTargets = getLegalTargets(current, actor.id, mode.abilityId);
        const target = legalTargets.find((candidate) => candidate.kind === "objective" && current.objectives.some((objective) => objective.id === candidate.objectiveId && objective.position.x === position.x && objective.position.y === position.y))
          ?? legalTargets.find((candidate) => candidate.kind === "cell" && candidate.position.x === position.x && candidate.position.y === position.y);
        return target ? resolveAbility(current, actor.id, mode.abilityId, target) : current;
      }
      return current;
    });
    setMode({ kind: "none" });
  }, [mode]);
  const onUnit = useCallback((targetId: string) => {
    if (mode.kind !== "ability") return;
    setState((current) => {
      const actor = activeCombatant(current);
      if (!actor) return current;
      const target = getLegalTargets(current, actor.id, mode.abilityId).find((candidate) =>
        (candidate.kind === "unit" && candidate.unitId === targetId)
        || (candidate.kind === "self" && actor.id === targetId));
      return target ? resolveAbility(current, actor.id, mode.abilityId, target) : current;
    });
    setMode({ kind: "none" });
  }, [mode]);
  const finish = useCallback(() => { setState((current) => endActivation(current)); setMode({ kind: "none" }); }, []);
  const dismissEvent = useCallback(() => setState((current) => dismissScenarioEventNotice(current)), []);
  return { seed, heroIds, state, active, mode, hasSavedSession, setMode, setSeed, newExpedition, loadExpedition, onCell, onUnit, finish, dismissEvent };
}
