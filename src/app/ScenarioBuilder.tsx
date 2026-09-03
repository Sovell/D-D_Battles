import { useEffect, useMemo, useState } from "react";
import { monsters } from "../core/data/monsters";
import type { HeroProfile, ScenarioDefinition } from "../core/domain/types";
import { buildScenarioFromDraft, createDefaultScenarioDraft, regenerateScenarioMap, selectScenarioPreset, setMonsterCount, validateScenarioDraft, type ScenarioDraft, type SupportedScenarioPresetId } from "./scenario-builder-model";
import { HeroRosterBuilder } from "./HeroRosterBuilder";
import { ScenarioEventEditor } from "./ScenarioEventEditor";
import { ScenarioMapEditor } from "./ScenarioMapEditor";
import { loadScenarioDraft, saveScenarioDraft } from "./session-storage";
import { UnitPortrait } from "./UnitPortrait";

export interface ScenarioLaunchConfig { seed: number; scenario: ScenarioDefinition; heroProfiles: HeroProfile[] }

export function ScenarioBuilder({ profiles, onCreateProfile, onUpdateProfile, onLaunch, onBack }: { profiles: HeroProfile[]; onCreateProfile(profile: HeroProfile): void; onUpdateProfile(profile: HeroProfile): void; onLaunch(config: ScenarioLaunchConfig): void; onBack(): void }) {
  const [draft, setDraft] = useState<ScenarioDraft>(() => {
    const restored = loadScenarioDraft() ?? createDefaultScenarioDraft();
    const available = restored.heroProfileIds.filter((id) => profiles.some((profile) => profile.id === id));
    return { ...restored, heroProfileIds: available.length >= 3 ? available.slice(0, 4) : profiles.slice(0, 4).map((profile) => profile.id) };
  });
  const errors = useMemo(() => validateScenarioDraft(draft, profiles), [draft, profiles]);
  const monsterOptions = monsters.filter((monster) => monster.id !== "owlbear" && (monster.id !== "ritualist" || draft.presetId === "interrupt-the-ritual"));
  const themeLabel = { dungeon: "Lochy", outdoor: "Teren otwarty", interior: "Wnętrze" }[draft.mapEnvironment];
  useEffect(() => saveScenarioDraft(draft), [draft]);

  function chooseScenario(presetId: SupportedScenarioPresetId) {
    setDraft((current) => selectScenarioPreset(current, presetId));
  }

  return <main className="launcher-shell">
    <header className="launcher-header">
      <div><span className="eyebrow">NOWA EKSPEDYCJA</span><h1>D&amp;D Battles</h1><p>Przygotuj scenariusz, zbierz drużynę i ruszaj do podziemi.</p></div>
      <div className="launcher-header-actions"><button className="resume-button" onClick={onBack} type="button"><span>← MENU GŁÓWNE</span><strong>Wróć do sali przygód</strong></button><div className="launcher-rune" aria-hidden="true">20</div></div>
    </header>

    <section className="builder-section scenario-choice">
      <div className="section-heading"><span>01</span><div><h2>Scenariusz</h2><p>Wybierz strukturę celu wyprawy.</p></div></div>
      <div className="scenario-cards">
        <button aria-pressed={draft.presetId === "cleanse-the-crypt"} className={`scenario-card ${draft.presetId === "cleanse-the-crypt" ? "selected" : ""}`} onClick={() => chooseScenario("cleanse-the-crypt")} type="button">
          <span className="card-status ready">GOTOWY</span><strong>Oczyść kryptę</strong><p>Zniszcz nekromantyczne ogniska i pokonaj wszystkich nieumarłych.</p><small>Crypt · cele do zniszczenia · 100 XP za zwycięstwo</small>
        </button>
        <button aria-pressed={draft.presetId === "interrupt-the-ritual"} className={`scenario-card ${draft.presetId === "interrupt-the-ritual" ? "selected" : ""}`} onClick={() => chooseScenario("interrupt-the-ritual")} type="button"><span className="card-status ready">GOTOWY</span><strong>Przerwany rytuał</strong><p>Zatrzymaj rytualistę przed końcem ósmej rundy.</p><small>Ruins · limit rund · 140 XP za zwycięstwo</small></button>
        <button className="scenario-card" disabled type="button"><span className="card-status">NASTĘPNY ETAP</span><strong>Ucieczka z legowiska</strong><p>Zdobądź artefakt i wyprowadź drużynę ze strefy zagrożenia.</p><small>Cave · artefakt · ewakuacja</small></button>
      </div>
    </section>

    <section className="builder-section">
      <div className="section-heading"><span>02</span><div><h2>Świat i mapa</h2><p>Wygeneruj teren, a potem popraw go jak mistrz gry.</p></div></div>
      <ScenarioMapEditor draft={draft} onChange={setDraft} />
    </section>

    <section className="builder-section">
      <div className="section-heading"><span>03</span><div><h2>Drużyna</h2><p>Wybierz 3–4 zapisanych bohaterów albo stwórz nowego.</p></div><b>{draft.heroProfileIds.length}/4</b></div>
      <HeroRosterBuilder profiles={profiles} selectedIds={draft.heroProfileIds} onSelectionChange={(heroProfileIds) => setDraft((current) => ({ ...current, heroProfileIds }))} onCreate={onCreateProfile} onUpdate={onUpdateProfile} />
    </section>

    <section className="builder-section">
      <div className="section-heading"><span>04</span><div><h2>Spotkanie</h2><p>Obsadź mapę przeciwnikami. Liczbę ogranicza wyłącznie wolne miejsce.</p></div><b>{draft.monsterIds.length} przeciwników</b></div>
      <div className="monster-builder">{monsterOptions.map((monster) => {
        const count = draft.monsterIds.filter((id) => id === monster.id).length;
        const mandatory = monster.id === "ritualist" && draft.presetId === "interrupt-the-ritual";
          return <article className={`monster-row ${mandatory ? "mandatory" : ""}`} key={monster.id}><UnitPortrait definitionId={monster.id} label={`Portret ${monster.name}`} /><div><strong>{monster.name}</strong><small>{mandatory ? "OBOWIĄZKOWY CEL · " : ""}{monster.doctrine} · HP {monster.maxHp} · Obrona {monster.defenseClass}</small></div><div className="counter"><button aria-label={`Usuń ${monster.name}`} disabled={mandatory || count === 0} onClick={() => setDraft((current) => setMonsterCount(current, monster.id, count - 1))}>−</button><b>{count}</b><button aria-label={`Dodaj ${monster.name}`} disabled={mandatory} onClick={() => setDraft((current) => setMonsterCount(current, monster.id, count + 1))}>+</button></div></article>;
      })}</div>
    </section>

    <section className="builder-section">
      <div className="section-heading"><span>05</span><div><h2>Wydarzenia</h2><p>Zaplanuj momenty, w których świat odpowie na działania drużyny.</p></div><b>{draft.events.length}</b></div>
      <ScenarioEventEditor events={draft.events} onChange={(events) => setDraft((current) => ({ ...current, events }))} />
    </section>

    <section className="builder-footer">
      <label>Nazwa wyprawy<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
      <label>Seed mapy<input type="number" value={draft.seed} onChange={(event) => setDraft((current) => ({ ...current, seed: Number(event.target.value) }))} /></label>
      <button className="random-seed" onClick={() => setDraft((current) => regenerateScenarioMap({ ...current, seed: Math.floor(Math.random() * 900000) + 100000 }))} type="button">Losuj i generuj</button>
      <div className="launch-block"><small>{errors[0] ?? `${draft.heroProfileIds.length} bohaterów · ${draft.monsterIds.length} przeciwników · ${themeLabel}`}</small><button className="launch-button" disabled={errors.length > 0} onClick={() => onLaunch({ seed: draft.seed, scenario: buildScenarioFromDraft(draft, profiles), heroProfiles: draft.heroProfileIds.map((id) => profiles.find((profile) => profile.id === id)!) })} type="button">Rozpocznij scenariusz <span>→</span></button></div>
    </section>
  </main>;
}
