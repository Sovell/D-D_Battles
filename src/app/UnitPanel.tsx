import { useState } from "react";
import type { BattleState, Combatant } from "../core/domain/types";
import { abilityCooldownRemaining } from "../core/rules/combat";
import { UnitPortrait } from "./UnitPortrait";

export function UnitPanel({ state, selectedUnitId, onSelect }: { state: BattleState; selectedUnitId?: string; onSelect(id: string): void }) {
  const [tab, setTab] = useState<"unit" | "party">("unit");
  const selected = state.combatants.find((unit) => unit.id === selectedUnitId) ?? state.combatants.find((unit) => unit.id === state.initiativeOrder[state.activeIndex]) ?? state.combatants[0];
  return <aside className="party-panel panel unit-panel">
    <div className="unit-panel-tabs" role="tablist" aria-label="Panel jednostek">
      <button className={tab === "unit" ? "selected" : ""} role="tab" aria-selected={tab === "unit"} onClick={() => setTab("unit")} type="button">Jednostka</button>
      <button className={tab === "party" ? "selected" : ""} role="tab" aria-selected={tab === "party"} onClick={() => setTab("party")} type="button">Drużyna</button>
    </div>
    {tab === "unit" ? <UnitInspector state={state} unit={selected} /> : <PartyOverview state={state} selectedId={selected.id} onSelect={(id) => { onSelect(id); setTab("unit"); }} />}
  </aside>;
}

function UnitInspector({ state, unit }: { state: BattleState; unit: Combatant }) {
  return <div className="unit-inspector">
    <div className={`unit-portrait-frame ${unit.side}`}><UnitPortrait definitionId={unit.definitionId} variant={unit.artVariant} label={`Portret ${unit.name}`} /><span>{unit.side === "heroes" ? `WARIANT ${(unit.artVariant ?? 0) + 1}` : unit.name.toUpperCase()}</span></div>
    <div className="unit-identity"><span>{unit.side === "heroes" ? "BOHATER" : "PRZECIWNIK"}</span><h2>{unit.name}</h2><ActivationBadge state={state} unit={unit} /></div>
    <div className="inspector-hp"><div><span>PUNKTY ŻYCIA</span><b>{unit.hp}/{unit.maxHp}</b></div><div className="hp"><i style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} /></div></div>
    <div className="unit-stat-grid"><Stat label="OBRONA" value={unit.defenseClass} title={unit.derivedStats ? acTitle(unit.derivedStats.acBreakdown) : undefined} /><Stat label="SZYBKOŚĆ" value={unit.speed} /><Stat label="INICJATYWA" value={unit.initiative} /><Stat label="ATAK PODST." value={`${(unit.basicAttack.attackBonusOverride ?? unit.attackBonus) >= 0 ? "+" : ""}${unit.basicAttack.attackBonusOverride ?? unit.attackBonus}`} title={unit.basicAttack.description} /></div>
    {unit.abilityScores && <div className="save-grid"><span>SIŁ <b>{unit.abilityScores.strength}</b></span><span>ZRĘ <b>{unit.abilityScores.dexterity}</b></span><span>KON <b>{unit.abilityScores.constitution}</b></span><span>INT <b>{unit.abilityScores.intelligence}</b></span><span>MĄD <b>{unit.abilityScores.wisdom}</b></span><span>CHA <b>{unit.abilityScores.charisma}</b></span></div>}
    {unit.side === "heroes" && <div className="save-grid"><span>{unit.definitionId === "sorcerer" ? "Arcane Surge" : "Ładunki"} <b>{unit.charges}/{unit.maxCharges}</b></span></div>}
    <div className="save-grid"><span title={saveTitle(unit, "fortitude")}>Fort <b>{signed(unit.saves.fortitude)}</b></span><span title={saveTitle(unit, "reflex")}>Ref <b>{signed(unit.saves.reflex)}</b></span><span title={saveTitle(unit, "will")}>Will <b>{signed(unit.saves.will)}</b></span></div>
    <section className="inspector-section"><h3>Statusy</h3><div className="status-chips">{unit.statuses.length ? unit.statuses.map((status) => <span key={status.id}>{status.id} · {status.remainingRounds}</span>) : <small>Brak aktywnych efektów</small>}</div></section>
    <section className="inspector-section"><h3>Zdolności</h3><div className="inspector-abilities">{[unit.basicAttack, ...unit.abilities].map((ability) => { const cooldown = abilityCooldownRemaining(state, unit.id, ability.id); return <article key={ability.id}><strong>{ability.name}</strong><span>{ability.description}</span><span>Zasięg {ability.range} · {ability.resourceCost ? `koszt ${ability.resourceCost}` : "bez kosztu"}</span>{cooldown > 0 && <em>Cooldown: {cooldown}</em>}</article>; })}</div></section>
  </div>;
}

function PartyOverview({ state, selectedId, onSelect }: { state: BattleState; selectedId: string; onSelect(id: string): void }) {
  return <div className="party-overview"><h2>Drużyna</h2>{state.combatants.filter((unit) => unit.side === "heroes").map((hero) => <button className={`unit-card ${selectedId === hero.id ? "inspected" : ""}`} key={hero.id} onClick={() => onSelect(hero.id)} type="button"><UnitPortrait className="party-card-portrait" definitionId={hero.definitionId} variant={hero.artVariant} /><div className="party-card-heading"><strong>{hero.name}</strong><span>{hero.hp > 0 ? `${hero.hp}/${hero.maxHp} HP` : "POLEGŁ"}</span></div><div className="hp"><i style={{ width: `${Math.max(0, hero.hp / hero.maxHp * 100)}%` }} /></div><div className="card-footer"><small>{hero.statuses.map((status) => status.id).join(", ") || "bez warunków"}</small><ActivationBadge state={state} unit={hero} /></div></button>)}</div>;
}

export function ActivationBadge({ state, unit }: { state: BattleState; unit: Combatant }) {
  const status = unit.hp <= 0 ? "DOWN" : unit.activatedRound === state.round ? "ACTIVATED" : "READY";
  return <i className={`activation-badge ${status.toLowerCase()}`}>{status}</i>;
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return <div title={title}><span>{label}</span><b>{value}</b></div>;
}

function acTitle(parts: NonNullable<Combatant["derivedStats"]>["acBreakdown"]): string {
  return `KP: 10 + Zręczność ${parts.dexterity} + pancerz ${parts.armor} + tarcza ${parts.shield} + naturalny ${parts.naturalArmor} + odbicie ${parts.deflection} + inne ${parts.other}`;
}

function saveTitle(unit: Combatant, save: "fortitude" | "reflex" | "will"): string | undefined {
  const parts = unit.derivedStats?.saveBreakdown[save];
  return parts ? `${save}: baza klasy ${signed(parts.base)} + cecha ${signed(parts.ability)} + ekwipunek ${signed(parts.equipment)}` : undefined;
}
function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }
