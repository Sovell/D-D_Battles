import { monsters } from "../core/data/monsters";
import type { ScenarioEventDefinition, ScenarioEventEffect, ScenarioEventTrigger, Side } from "../core/domain/types";

export function ScenarioEventEditor({ events, onChange }: { events: ScenarioEventDefinition[]; onChange(events: ScenarioEventDefinition[]): void }) {
  const update = (id: string, event: ScenarioEventDefinition) => onChange(events.map((candidate) => candidate.id === id ? event : candidate));
  const add = () => {
    const index = events.length + 1;
    onChange([...events, { id: uniqueId(events, `event-${index}`), name: `Nowe wydarzenie ${index}`, trigger: { type: "round-start", round: 2 }, effect: { type: "show-message", text: "Opisz, co wydarzyło się w świecie." }, visibility: "announced" }]);
  };
  return <div className="scenario-event-editor">
    <div className="event-editor-heading"><p>Połącz warunek ze skutkiem. Po rozpoczęciu bitwy świat przejmie AI.</p><button onClick={add} type="button">+ Dodaj wydarzenie</button></div>
    {events.length === 0 && <div className="empty-events">Scenariusz nie ma jeszcze wydarzeń.</div>}
    {events.map((event) => <details className="event-editor-card" key={event.id} open>
      <summary><span><strong>{event.name}</strong><small>{triggerLabel(event.trigger)} → {effectLabel(event.effect)}</small></span><b>{event.visibility === "hidden" ? "UKRYTE" : "ZAPOWIEDZIANE"}</b></summary>
      <div className="event-editor-fields">
        <label>Nazwa<input value={event.name} onChange={(change) => update(event.id, { ...event, name: change.target.value })} /></label>
        <label>Widoczność<select value={event.visibility ?? "hidden"} onChange={(change) => update(event.id, { ...event, visibility: change.target.value as ScenarioEventDefinition["visibility"] })}><option value="announced">Zapowiedziane</option><option value="hidden">Ukryte do aktywacji</option></select></label>
        <label>Wyzwalacz<select value={event.trigger.type} onChange={(change) => update(event.id, { ...event, trigger: defaultTrigger(change.target.value as ScenarioEventTrigger["type"]) })}><option value="battle-start">Początek bitwy</option><option value="round-start">Początek rundy</option><option value="unit-defeated">Pokonanie jednostki</option><option value="objective-destroyed">Zniszczenie celu</option><option value="unit-entered-cell">Wejście na pole</option></select></label>
        <label>Efekt<select value={event.effect.type} onChange={(change) => update(event.id, { ...event, effect: defaultEffect(change.target.value as ScenarioEventEffect["type"]) })}><option value="show-message">Pokaż komunikat</option><option value="change-objective">Zmień opis celu</option><option value="spawn-monsters">Dodaj potwory</option><option value="victory">Zwycięstwo</option><option value="defeat">Porażka</option></select></label>
        <TriggerFields trigger={event.trigger} onChange={(trigger) => update(event.id, { ...event, trigger })} />
        <EffectFields effect={event.effect} onChange={(effect) => update(event.id, { ...event, effect })} />
        <button className="delete-event" onClick={() => onChange(events.filter((candidate) => candidate.id !== event.id))} type="button">Usuń wydarzenie</button>
      </div>
    </details>)}
  </div>;
}

function TriggerFields({ trigger, onChange }: { trigger: ScenarioEventTrigger; onChange(trigger: ScenarioEventTrigger): void }) {
  if (trigger.type === "round-start") return <label>Numer rundy<input min={1} type="number" value={trigger.round} onChange={(event) => onChange({ ...trigger, round: positive(event.target.value) })} /></label>;
  if (trigger.type === "unit-defeated") return <><SideSelect side={trigger.side} onChange={(side) => onChange({ ...trigger, side })} /><label>Typ jednostki<select value={trigger.definitionId ?? ""} onChange={(event) => onChange({ ...trigger, definitionId: event.target.value || undefined })}><option value="">Dowolna</option>{monsters.map((monster) => <option key={monster.id} value={monster.id}>{monster.name}</option>)}</select></label></>;
  if (trigger.type === "objective-destroyed") return <label>ID celu (opcjonalnie)<input placeholder="Dowolny cel" value={trigger.objectiveId ?? ""} onChange={(event) => onChange({ ...trigger, objectiveId: event.target.value || undefined })} /></label>;
  if (trigger.type === "unit-entered-cell") return <><SideSelect side={trigger.side} onChange={(side) => onChange({ ...trigger, side })} /><label>Kolumna X<input min={0} type="number" value={trigger.position.x} onChange={(event) => onChange({ ...trigger, position: { ...trigger.position, x: nonNegative(event.target.value) } })} /></label><label>Wiersz Y<input min={0} type="number" value={trigger.position.y} onChange={(event) => onChange({ ...trigger, position: { ...trigger.position, y: nonNegative(event.target.value) } })} /></label></>;
  return null;
}

function EffectFields({ effect, onChange }: { effect: ScenarioEventEffect; onChange(effect: ScenarioEventEffect): void }) {
  if (effect.type === "spawn-monsters") {
    const monsterId = effect.monsterIds[0] ?? monsters[0].id;
    return <><label>Potwór<select value={monsterId} onChange={(event) => onChange({ ...effect, monsterIds: Array.from({ length: effect.monsterIds.length || 1 }, () => event.target.value) })}>{monsters.map((monster) => <option key={monster.id} value={monster.id}>{monster.name}</option>)}</select></label><label>Liczba<input min={1} type="number" value={effect.monsterIds.length} onChange={(event) => onChange({ ...effect, monsterIds: Array.from({ length: positive(event.target.value) }, () => monsterId) })} /></label></>;
  }
  return <label className="event-text">{effect.type === "change-objective" ? "Nowy opis celu" : effect.type === "show-message" ? "Treść komunikatu" : "Komunikat końcowy"}<textarea value={effect.text} onChange={(event) => onChange({ ...effect, text: event.target.value })} /></label>;
}

function SideSelect({ side, onChange }: { side?: Side; onChange(side?: Side): void }) { return <label>Strona<select value={side ?? ""} onChange={(event) => onChange(event.target.value ? event.target.value as Side : undefined)}><option value="">Dowolna</option><option value="heroes">Bohaterowie</option><option value="monsters">Potwory</option></select></label>; }
function defaultTrigger(type: ScenarioEventTrigger["type"]): ScenarioEventTrigger { if (type === "round-start") return { type, round: 2 }; if (type === "unit-defeated") return { type, side: "monsters" }; if (type === "objective-destroyed") return { type }; if (type === "unit-entered-cell") return { type, side: "heroes", position: { x: 0, y: 0 } }; return { type }; }
function defaultEffect(type: ScenarioEventEffect["type"]): ScenarioEventEffect { if (type === "spawn-monsters") return { type, monsterIds: ["skeleton"] }; if (type === "change-objective") return { type, text: "Nowy cel wyprawy." }; if (type === "victory") return { type, text: "Scenariusz zakończony zwycięstwem." }; if (type === "defeat") return { type, text: "Scenariusz zakończony porażką." }; return { type, text: "Nowe wydarzenie w świecie." }; }
function triggerLabel(trigger: ScenarioEventTrigger): string { return ({ "battle-start": "Początek bitwy", "round-start": `Runda ${trigger.type === "round-start" ? trigger.round : ""}`, "unit-defeated": "Pokonanie jednostki", "objective-destroyed": "Zniszczenie celu", "unit-entered-cell": "Wejście na pole" })[trigger.type]; }
function effectLabel(effect: ScenarioEventEffect): string { return ({ "show-message": "Komunikat", "change-objective": "Zmiana celu", "spawn-monsters": "Posiłki", victory: "Zwycięstwo", defeat: "Porażka" })[effect.type]; }
function positive(value: string): number { return Math.max(1, Math.floor(Number(value) || 1)); }
function nonNegative(value: string): number { return Math.max(0, Math.floor(Number(value) || 0)); }
function uniqueId(events: ScenarioEventDefinition[], base: string): string { let id = base; let suffix = 2; while (events.some((event) => event.id === id)) id = `${base}-${suffix++}`; return id; }
