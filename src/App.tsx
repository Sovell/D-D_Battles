import { useEffect, useState } from "react";
import { ScenarioBuilder, type ScenarioLaunchConfig } from "./app/ScenarioBuilder";
import { useBattleSession } from "./app/use-battle-session";
import { PixiBattlefield } from "./battlefield/PixiBattlefield";

export function App() {
  const [screen, setScreen] = useState<"builder" | "battle">("builder");
  const session = useBattleSession(screen === "battle");
  const { state, active } = session;
  const isRitual = state.scenario.victoryCondition === "defeat-ritualist";
  const ritualist = state.combatants.find((unit) => unit.tags.includes("ritualist"));
  const ritualLimit = state.scenario.roundLimit ?? 8;
  const ritualProgress = Math.min(ritualLimit, Math.max(0, state.round - 1));
  const outcomeTitle = state.outcome === "victory" ? (isRitual ? "Rytuał przerwany" : "Krypta oczyszczona") : (isRitual ? "Rytuał został zakończony" : "Drużyna poległa");

  function launch(config: ScenarioLaunchConfig) {
    session.newExpedition(config.seed, config.scenario, config.heroIds);
    setScreen("battle");
  }

  useEffect(() => {
    if (screen !== "battle") return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key.toLowerCase() === "m") session.setMode({ kind: "move" });
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); session.finish(); }
      const index = Number(event.key) - 1;
      const ability = active && [active.basicAttack, ...active.abilities][index];
      if (ability) session.setMode({ kind: "ability", abilityId: ability.id });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, screen, session]);

  if (screen === "builder") return <ScenarioBuilder onLaunch={launch} />;

  return <main className="game-shell">
    <header className="topbar">
      <div><span className="eyebrow">TACTICAL D20 PROTOTYPE</span><h1>D&amp;D Battles</h1></div>
      <div className="battle-top-actions"><span>Seed <b>{session.seed}</b></span><button type="button" onClick={() => setScreen("builder")}>Scenariusze i drużyna</button></div>
    </header>
    <aside className="party-panel panel"><h2>Drużyna</h2>{state.combatants.filter((unit) => unit.side === "heroes").map((hero) => <article className={`unit-card ${active?.id === hero.id ? "active" : ""}`} key={hero.id}><div><strong>{hero.name}</strong><span>{hero.hp > 0 ? `${hero.hp}/${hero.maxHp} HP` : "POLEGŁ"}</span></div><div className="hp"><i style={{ width: `${Math.max(0, hero.hp / hero.maxHp * 100)}%` }} /></div><small>{hero.statuses.map((status) => status.id).join(", ") || "bez warunków"}</small></article>)}</aside>
    <section className="board-frame"><PixiBattlefield state={state} showMovement={session.mode.kind === "move"} onCell={session.onCell} onUnit={session.onUnit} />{state.outcome !== "active" && <div className="outcome"><h2>{outcomeTitle}</h2><div><button onClick={() => session.newExpedition(session.seed + 1)}>Powtórz z nowym seedem</button><button onClick={() => setScreen("builder")}>Nowy scenariusz</button></div></div>}</section>
    <aside className="mission-panel panel"><span className="eyebrow">RUNDA {state.round}</span><h2>{state.scenario.name}</h2><p>{state.scenario.objectiveText}</p>{isRitual ? <div className="ritual-tracker"><div><span>Rytualista</span><b>{ritualist?.hp ?? 0}/{ritualist?.maxHp ?? 0} HP</b></div><div className="ritual-progress"><i style={{ width: `${ritualProgress / ritualLimit * 100}%` }} /></div><small>Postęp rytuału: {ritualProgress}/{ritualLimit} · pozostałe rundy: {Math.max(0, ritualLimit - ritualProgress)}</small></div> : <div className="objective-list">{state.objectives.map((objective) => <div key={objective.id}><span>Nekromantyczne ognisko</span><b>{objective.hp}/{objective.maxHp}</b></div>)}</div>}<h3>Inicjatywa</h3><ol>{state.initiativeOrder.map((id) => { const unit = state.combatants.find((candidate) => candidate.id === id)!; return <li className={active?.id === id ? "current" : ""} key={id}><span>{unit.name}</span><b>{unit.initiative}</b></li>; })}</ol><h3>Dziennik rzutów</h3><div className="log" aria-live="polite">{state.log.slice(-8).reverse().map((entry) => <p className={entry.kind} key={entry.id}>{entry.text}</p>)}</div></aside>
    <footer className="action-bar"><div className="turn-title"><span>AKTYWNA JEDNOSTKA</span><strong>{active?.name ?? "—"}</strong><small>{active?.side === "heroes" ? `${active.charges} ładunki` : "Ruch przeciwnika"}</small></div>{active?.side === "heroes" && <><button className={session.mode.kind === "move" ? "selected" : ""} onClick={() => session.setMode({ kind: "move" })}><kbd>M</kbd><strong>Ruch</strong><small>Wybierz zielone pole</small></button>{[active.basicAttack, ...active.abilities].map((ability, index) => <button disabled={active.acted || active.charges < ability.resourceCost} className={session.mode.kind === "ability" && session.mode.abilityId === ability.id ? "selected" : ""} title={ability.description} onClick={() => session.setMode({ kind: "ability", abilityId: ability.id })} key={ability.id}><kbd>{index + 1}</kbd><strong>{ability.name}</strong><small>{ability.resourceCost ? `${ability.resourceCost} ładunek` : "bez kosztu"}</small></button>)}<button onClick={session.finish}><kbd>⏎</kbd><strong>Koniec</strong><small>Zakończ aktywację</small></button></>}</footer>
  </main>;
}
