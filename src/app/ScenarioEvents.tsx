import type { BattleState, ScenarioEventNotice, ScenarioEventTrigger } from "../core/domain/types";

export function ScenarioEventsTimeline({ state }: { state: BattleState }) {
  const resolved = new Set(state.resolvedEventIds ?? []);
  const upcoming = (state.scenario.events ?? []).filter((event) => event.visibility === "announced" && !resolved.has(event.id));
  if (upcoming.length === 0) return null;
  return <section className="event-timeline">
    <h3>Nadchodzące wydarzenia</h3>
    {upcoming.map((event) => <article key={event.id}><strong>{event.name}</strong><small>{describeTrigger(event.trigger)}</small></article>)}
  </section>;
}

export function ScenarioEventDialog({ notice, onContinue }: { notice: ScenarioEventNotice; onContinue(): void }) {
  return <div className="event-overlay" role="presentation">
    <section aria-labelledby="scenario-event-title" aria-modal="true" className="event-dialog" role="dialog">
      <span className="eyebrow">WYDARZENIE SCENARIUSZA</span>
      <h2 id="scenario-event-title">{notice.name}</h2>
      <p>{notice.text}</p>
      <button autoFocus onClick={onContinue} type="button">Kontynuuj <b>→</b></button>
    </section>
  </div>;
}

function describeTrigger(trigger: ScenarioEventTrigger): string {
  if (trigger.type === "battle-start") return "Na początku bitwy";
  if (trigger.type === "round-start") return `Początek rundy ${trigger.round}`;
  if (trigger.type === "unit-defeated") return trigger.definitionId ? `Po pokonaniu: ${trigger.definitionId}` : "Po pokonaniu jednostki";
  if (trigger.type === "objective-destroyed") return "Po zniszczeniu celu";
  return `Po wejściu na pole ${trigger.position.x},${trigger.position.y}`;
}
