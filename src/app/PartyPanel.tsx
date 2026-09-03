import { useState } from "react";
import type { CampaignState, EquipmentSlot, HeroProfile } from "../core/domain/types";
import { heroClassById } from "../core/data/heroes";
import { equipItem, equippedIds, unequipItem } from "../core/equipment/campaign";
import { itemById } from "../core/equipment/items";
import { races } from "../core/progression/hero-progression";
import { HeroRosterBuilder } from "./HeroRosterBuilder";
import { UnitPortrait } from "./UnitPortrait";

type PartyTab = "party" | "heroes" | "equipment";
const slots: Array<{ id: Exclude<EquipmentSlot, "consumable">; name: string }> = [{ id: "weapon", name: "Broń" }, { id: "armor", name: "Pancerz" }, { id: "shield", name: "Tarcza" }, { id: "cloak", name: "Płaszcz" }, { id: "boots", name: "Buty" }, { id: "belt", name: "Pas" }, { id: "trinket", name: "Talizman" }];

export function PartyPanel({ campaign, onChange, onBack }: { campaign: CampaignState; onChange(campaign: CampaignState): void; onBack(): void }) {
  const [tab, setTab] = useState<PartyTab>("party");
  const [heroId, setHeroId] = useState(campaign.activePartyIds[0] ?? campaign.heroes[0]?.id ?? "");
  const hero = campaign.heroes.find((candidate) => candidate.id === heroId) ?? campaign.heroes[0];
  const loadout = hero ? campaign.loadouts[hero.id] : undefined;
  const updateHero = (profile: HeroProfile) => onChange({ ...campaign, heroes: campaign.heroes.map((candidate) => candidate.id === profile.id ? profile : candidate) });
  const createHero = (profile: HeroProfile) => onChange({ ...campaign, heroes: [...campaign.heroes, profile], loadouts: { ...campaign.loadouts, [profile.id]: { weapon: null, armor: null, shield: null, cloak: null, boots: null, belt: null, trinket: null, consumables: [null, null, null] } } });

  return <main className="launcher-shell party-shell">
    <header className="launcher-header"><div><span className="eyebrow">ZAPLECZE KAMPANII</span><h1>Drużyna</h1><p>Profile, aktywny skład i wspólny magazyn pozostają między scenariuszami.</p></div><button className="resume-button" onClick={onBack}>← Menu główne</button></header>
    <nav aria-label="Panel drużyny" className="party-tabs">{(["party", "heroes", "equipment"] as PartyTab[]).map((id) => <button aria-pressed={tab === id} className={tab === id ? "selected" : ""} key={id} onClick={() => setTab(id)}>{id === "party" ? "Drużyna" : id === "heroes" ? "Bohaterowie" : "Ekwipunek"}</button>)}</nav>
    {tab === "party" && <section className="builder-section"><div className="section-heading"><span>01</span><div><h2>Aktywna drużyna</h2><p>Do scenariusza wyruszy 3–4 zaznaczonych bohaterów.</p></div><b>{campaign.activePartyIds.length}/4</b></div><div className="campaign-hero-grid">{campaign.heroes.map((profile) => <HeroCampaignCard key={profile.id} profile={profile} loadoutIds={equippedIds(campaign.loadouts[profile.id])} selected={campaign.activePartyIds.includes(profile.id)} onClick={() => onChange({ ...campaign, activePartyIds: campaign.activePartyIds.includes(profile.id) ? campaign.activePartyIds.filter((id) => id !== profile.id) : [...campaign.activePartyIds, profile.id].slice(0, 4) })} />)}</div></section>}
    {tab === "heroes" && <section className="builder-section"><div className="section-heading"><span>02</span><div><h2>Bohaterowie</h2><p>Twórz profile i wybieraj rozwój poziomów 1–5.</p></div></div><HeroRosterBuilder profiles={campaign.heroes} selectedIds={campaign.activePartyIds} onSelectionChange={(activePartyIds) => onChange({ ...campaign, activePartyIds })} onCreate={createHero} onUpdate={updateHero} /></section>}
    {tab === "equipment" && hero && loadout && <section className="builder-section equipment-workshop"><div className="section-heading"><span>03</span><div><h2>Ekwipunek</h2><p>Wyposażenie można zmieniać wyłącznie poza scenariuszem.</p></div></div><div className="equipment-layout"><aside className="equipment-heroes">{campaign.heroes.map((profile) => <button className={profile.id === hero.id ? "selected" : ""} key={profile.id} onClick={() => setHeroId(profile.id)}><UnitPortrait definitionId={profile.classId} variant={profile.portraitVariant} /><span><strong>{profile.name}</strong><small>Poziom {profile.level}</small></span></button>)}</aside><div className="loadout-panel"><h3>{hero.name} · sloty</h3><div className="loadout-slots">{slots.map((slot) => <LoadoutSlot key={slot.id} name={slot.name} itemId={loadout[slot.id]} onRemove={() => onChange(unequipItem(campaign, hero.id, slot.id))} />)}{loadout.consumables.map((id, index) => <LoadoutSlot key={index} name={`Consumable ${index + 1}`} itemId={id} onRemove={() => onChange(unequipItem(campaign, hero.id, "consumable", index))} />)}</div></div><div className="inventory-panel"><h3>Wspólny magazyn</h3>{campaign.inventory.map((stack) => { const definition = itemById.get(stack.definitionId)!; const compatible = definition.levelMin <= hero.level; return <article key={definition.id}><div><strong>{definition.name} <em>{definition.rarity}</em></strong><small>{definition.description}</small><span>{definition.slot} · poziom {definition.levelMin}+ · sztuk: {stack.quantity}</span></div><button disabled={!compatible} onClick={() => onChange(equipItem(campaign, hero.id, definition.id, definition.slot === "consumable" ? Math.max(0, loadout.consumables.findIndex((id) => !id)) : 0))}>{compatible ? "Wyposaż" : `Wymaga poziomu ${definition.levelMin}`}</button></article>; })}</div></div></section>}
  </main>;
}

function HeroCampaignCard({ profile, loadoutIds, selected, onClick }: { profile: HeroProfile; loadoutIds: string[]; selected: boolean; onClick(): void }) {
  const heroClass = heroClassById.get(profile.classId)!; const race = races.find((candidate) => candidate.id === profile.race)!;
  const abilityNames = profile.selectedAbilityIds.map((id) => heroClass.abilities.find((ability) => ability.id === id)?.name ?? id);
  return <button aria-pressed={selected} className={`campaign-hero-card ${selected ? "selected" : ""}`} onClick={onClick}><UnitPortrait definitionId={profile.classId} variant={profile.portraitVariant} label={`Portret ${profile.name}`} /><div><strong>{profile.name}</strong><small>{race.name} · {heroClass.name} · poziom {profile.level} · {profile.xp} XP</small><p>Zdolności: {abilityNames.join(", ") || "brak"}</p><p>Sloty: {loadoutIds.map((id) => itemById.get(id)?.name).join(", ") || "puste"}</p></div><b>{selected ? "W DRUŻYNIE" : "DODAJ"}</b></button>;
}
function LoadoutSlot({ name, itemId, onRemove }: { name: string; itemId: string | null; onRemove(): void }) { return <div><span>{name}</span><strong>{itemId ? itemById.get(itemId)?.name : "Pusty"}</strong>{itemId && <button onClick={onRemove}>Zdejmij</button>}</div>; }
