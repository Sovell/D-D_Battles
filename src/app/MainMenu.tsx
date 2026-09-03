import { useState } from "react";
import { loadManualBattleSaves, type NamedBattleSave } from "./session-storage";

export function MainMenu({
  continueSummary,
  onContinue,
  onLoad,
  onNewScenario,
}: {
  continueSummary?: string;
  onContinue?(): void;
  onLoad(save: NamedBattleSave): void;
  onNewScenario(): void;
}) {
  const [saves] = useState(() => loadManualBattleSaves());
  const [selectedSaveId, setSelectedSaveId] = useState(saves[0]?.id ?? "");
  const selectedSave = saves.find((save) => save.id === selectedSaveId);

  return <main className="main-menu-shell">
    <section className="main-menu-hero">
      <div className="menu-sigil" aria-hidden="true">20</div>
      <div><span className="eyebrow">D&amp;D BATTLES · SALA PRZYGÓD</span><h1>Twoja opowieść<br />czeka na dalszy ciąg</h1><p>Rozpocznij nową wyprawę, wróć do trwającego starcia albo odtwórz jeden z zachowanych momentów przygody.</p></div>
    </section>

    <section className="menu-console" aria-label="Menu główne">
      <div className="menu-launch-bay">
        <div className="menu-section-label"><span>01</span><div><small>PRZYGODA</small><strong>Wybierz punkt wejścia</strong></div></div>
        <div className="menu-primary-actions">
          <button className="adventure-card new-adventure" onClick={onNewScenario} type="button"><span>NOWA WYPRAWA</span><strong>Nowy scenariusz</strong><small>Wybierz cel, drużynę, przeciwników i seed mapy.</small><b>→</b></button>
          <button className="adventure-card continue-adventure" disabled={!onContinue} onClick={onContinue} type="button"><span>OSTATNIA SESJA</span><strong>Kontynuuj bitwę</strong><small>{continueSummary ?? "Brak rozpoczętej bitwy."}</small><b>→</b></button>
        </div>

        <section className="load-save-card">
          <div className="load-save-header"><div><span>ZAPISY LOKALNE</span><strong>Wczytaj zapis</strong></div><b>{saves.length.toString().padStart(2, "0")}</b></div>
          <label htmlFor="battle-save-select">Zachowane bitwy</label>
          <select id="battle-save-select" disabled={saves.length === 0} value={selectedSaveId} onChange={(event) => setSelectedSaveId(event.target.value)}>
            {saves.length === 0 ? <option value="">Brak zapisów</option> : saves.map((save) => <option key={save.id} value={save.id}>{save.name} · {formatDate(save.savedAt)}</option>)}
          </select>
          <button disabled={!selectedSave} onClick={() => selectedSave && onLoad(selectedSave)} type="button">Wczytaj wybraną bitwę</button>
          <small>Ręczne zapisy utworzysz podczas rozgrywki.</small>
        </section>
      </div>

      <aside className="future-modules">
        <div className="menu-section-label"><span>02</span><div><small>ZAPLECZE DRUŻYNY</small><strong>Kronika i przyszłe moduły</strong></div></div>
        <article><span>BOHATEROWIE</span><strong>Profile drużyny</strong><small>Tworzenie postaci, rasy, poziomy doświadczenia i wybory rozwoju.</small><i>DOSTĘPNE W KREATORZE</i></article>
        <article><span>KAMPANIE</span><strong>Dłuższe opowieści</strong><small>Połączone scenariusze, rozwój i trwały loot.</small><i>W PLANACH</i></article>
      </aside>
    </section>
  </main>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "nieznana data" : date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}
