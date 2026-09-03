import { useEffect, useRef, useState } from "react";
import { ScenarioBuilder, type ScenarioLaunchConfig } from "./app/ScenarioBuilder";
import { MainMenu } from "./app/MainMenu";
import { ScenarioEventDialog, ScenarioEventsTimeline } from "./app/ScenarioEvents";
import { ActivationBadge, UnitPanel } from "./app/UnitPanel";
import { useBattleSession } from "./app/use-battle-session";
import { PixiBattlefield } from "./battlefield/PixiBattlefield";
import { createManualBattleSave, loadHeroProfiles, saveHeroProfiles, type AppScreen } from "./app/session-storage";
import { abilityCooldownRemaining, getLegalTargets } from "./core/rules/combat";
import { awardVictoryXp, scenarioVictoryXp } from "./core/progression/hero-progression";
import type { HeroProfile } from "./core/domain/types";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("menu");
  const [saveStatus, setSaveStatus] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>();
  const [heroProfiles, setHeroProfiles] = useState<HeroProfile[]>(() => loadHeroProfiles());
  const awardingProgression = useRef(false);
  const session = useBattleSession(screen === "battle");
  const { state, active } = session;
  const inspectedUnitId = state.combatants.some((unit) => unit.id === selectedUnitId) ? selectedUnitId : active?.id;
  const isRitual = state.scenario.victoryCondition === "defeat-ritualist";
  const ritualist = state.combatants.find((unit) => unit.tags.includes("ritualist"));
  const ritualLimit = state.scenario.roundLimit ?? 8;
  const ritualProgress = Math.min(ritualLimit, Math.max(0, state.round - 1));
  const pendingEvent = state.pendingEventNotices?.[0];
  const outcomeTitle = state.outcome === "victory" ? (isRitual ? "Rytuał przerwany" : "Krypta oczyszczona") : (isRitual ? "Rytuał został zakończony" : "Drużyna poległa");

  function launch(config: ScenarioLaunchConfig) {
    session.newExpedition(config.seed, config.scenario, config.heroProfiles);
    setScreen("battle");
  }

  function saveBattle() {
    createManualBattleSave(session.seed, session.heroSnapshots, state);
    setSaveStatus("Zapisano");
    window.setTimeout(() => setSaveStatus(""), 1800);
  }

  useEffect(() => {
    saveHeroProfiles(heroProfiles);
  }, [heroProfiles]);

  useEffect(() => {
    if (state.outcome === "active") { awardingProgression.current = false; return; }
    if (state.outcome !== "victory" || state.progressionRewardClaimed || awardingProgression.current) return;
    awardingProgression.current = true;
    const participatingIds = (state.heroSnapshots ?? session.heroSnapshots).map((profile) => profile.id);
    setHeroProfiles((current) => awardVictoryXp(current, participatingIds, state.scenario.rewardXp));
    session.claimProgressionReward();
  }, [session, state.heroSnapshots, state.outcome, state.progressionRewardClaimed, state.scenario.rewardXp]);

  useEffect(() => {
    if (screen !== "battle") return;
    const handler = (event: KeyboardEvent) => {
      if (pendingEvent) return;
      if (event.target instanceof HTMLInputElement) return;
      if (event.key.toLowerCase() === "m") session.setMode({ kind: "move" });
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); session.finish(); }
      const index = Number(event.key) - 1;
      const ability = active && [active.basicAttack, ...active.abilities][index];
      if (ability) session.setMode({ kind: "ability", abilityId: ability.id });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, pendingEvent, screen, session]);

  if (screen === "menu") return <MainMenu onNewScenario={() => setScreen("builder")} onContinue={session.hasSavedSession ? () => setScreen("battle") : undefined} continueSummary={session.hasSavedSession ? `${state.scenario.name} · runda ${state.round} · seed ${session.seed}` : undefined} onLoad={(save) => { session.loadExpedition(save); setScreen("battle"); }} />;
  if (screen === "builder") return <ScenarioBuilder profiles={heroProfiles} onCreateProfile={(profile) => setHeroProfiles((current) => [...current, profile])} onUpdateProfile={(profile) => setHeroProfiles((current) => current.map((candidate) => candidate.id === profile.id ? profile : candidate))} onLaunch={launch} onBack={() => setScreen("menu")} />;

  return <main className="game-shell">
    <header className="topbar">
      <div><span className="eyebrow">TACTICAL D20 PROTOTYPE</span><h1>D&amp;D Battles</h1></div>
      <div className="battle-top-actions"><span>Seed <b>{session.seed}</b></span>{saveStatus && <span className="save-status">{saveStatus}</span>}<button type="button" onClick={saveBattle}>Zapisz grę</button><button type="button" onClick={() => setScreen("menu")}>Menu główne</button></div>
    </header>
    <UnitPanel state={state} selectedUnitId={inspectedUnitId} onSelect={setSelectedUnitId} />
    <section className="board-frame"><PixiBattlefield state={state} selectedUnitId={inspectedUnitId} showMovement={session.mode.kind === "move"} abilityId={session.mode.kind === "ability" ? session.mode.abilityId : undefined} onCell={session.onCell} onUnit={(id) => { setSelectedUnitId(id); session.onUnit(id); }} />{state.outcome !== "active" && <div className="outcome"><h2>{outcomeTitle}</h2>{state.outcome === "victory" && <p>Każdy bohater otrzymuje {scenarioVictoryXp(state.scenario.rewardXp)} XP.</p>}<div><button onClick={() => session.newExpedition(session.seed + 1)}>Powtórz z nowym seedem</button><button onClick={() => setScreen("builder")}>Nowy scenariusz</button></div></div>}</section>
    <aside className="mission-panel panel"><span className="eyebrow">RUNDA {state.round}</span><h2>{state.scenario.name}</h2><p>{state.objectiveTextOverride ?? state.scenario.objectiveText}</p>{isRitual ? <div className="ritual-tracker"><div><span>Rytualista</span><b>{ritualist?.hp ?? 0}/{ritualist?.maxHp ?? 0} HP</b></div><div className="ritual-progress"><i style={{ width: `${ritualProgress / ritualLimit * 100}%` }} /></div><small>Postęp rytuału: {ritualProgress}/{ritualLimit} · pozostałe rundy: {Math.max(0, ritualLimit - ritualProgress)}</small></div> : <div className="objective-list">{state.objectives.map((objective) => <div key={objective.id}><span>Nekromantyczne ognisko</span><b>{objective.hp}/{objective.maxHp}</b></div>)}</div>}<ScenarioEventsTimeline state={state} /><h3>Inicjatywa</h3><ol>{state.initiativeOrder.map((id) => { const unit = state.combatants.find((candidate) => candidate.id === id)!; return <li className={active?.id === id ? "current" : ""} key={id}><span>{unit.name}</span><ActivationBadge state={state} unit={unit} /><b>{unit.initiative}</b></li>; })}</ol><h3>Dziennik rzutów</h3><div className="log" aria-live="polite">{state.log.slice(-8).reverse().map((entry) => <p className={entry.kind} key={entry.id}>{entry.text}</p>)}</div></aside>
    <footer className="action-bar"><div className="turn-title"><span>AKTYWNA JEDNOSTKA</span><strong>{active?.name ?? "—"}</strong><small>{active?.side === "heroes" ? `${active.charges} ładunki` : "Ruch przeciwnika"}</small></div>{active?.side === "heroes" && <><button className={session.mode.kind === "move" ? "selected" : ""} onClick={() => session.setMode({ kind: "move" })}><kbd>M</kbd><strong>Ruch</strong><small>Wybierz zielone pole</small></button>{[active.basicAttack, ...active.abilities].map((ability, index) => { const cooldown = abilityCooldownRemaining(state, active.id, ability.id); const hasLegalTarget = getLegalTargets(state, active.id, ability.id).length > 0; return <button disabled={!hasLegalTarget} className={session.mode.kind === "ability" && session.mode.abilityId === ability.id ? "selected" : ""} title={ability.description} onClick={() => session.setMode({ kind: "ability", abilityId: ability.id })} key={ability.id}><kbd>{index + 1}</kbd><strong>{ability.name}</strong><small>{cooldown > 0 ? `Cooldown: ${cooldown} ${cooldown === 1 ? "runda" : "rundy"}` : `Zasięg ${ability.range} · ${ability.resourceCost ? `koszt ${ability.resourceCost}` : "bez kosztu"}`}</small></button>; })}<button onClick={session.finish}><kbd>⏎</kbd><strong>Koniec</strong><small>Zakończ aktywację</small></button></>}</footer>
    {pendingEvent && <ScenarioEventDialog notice={pendingEvent} onContinue={session.dismissEvent} />}
  </main>;
}
