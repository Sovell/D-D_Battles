import { useState } from "react";
import { heroClassById, heroClasses } from "../core/data/heroes";
import type { HeroProfile, RaceId } from "../core/domain/types";
import { chooseProgressionOption, createHeroProfile, pendingProgressionLevels, progressionOptions, races, XP_THRESHOLDS } from "../core/progression/hero-progression";
import { UnitPortrait } from "./UnitPortrait";
import { getUnitArtVariantCount } from "../presentation/unit-art";

export function HeroRosterBuilder({ profiles, selectedIds, onSelectionChange, onCreate, onUpdate }: {
  profiles: HeroProfile[];
  selectedIds: string[];
  onSelectionChange(ids: string[]): void;
  onCreate(profile: HeroProfile): void;
  onUpdate(profile: HeroProfile): void;
}) {
  const [name, setName] = useState("");
  const [race, setRace] = useState<RaceId>("human");
  const [classId, setClassId] = useState("fighter");
  const [portraitVariant, setPortraitVariant] = useState(0);
  const [creationError, setCreationError] = useState("");
  const portraitCount = Math.max(1, getUnitArtVariantCount(classId));

  function changePortrait(direction: -1 | 1) {
    setPortraitVariant((current) => (current + direction + portraitCount) % portraitCount);
  }

  function toggle(profileId: string) {
    onSelectionChange(selectedIds.includes(profileId) ? selectedIds.filter((id) => id !== profileId) : [...selectedIds, profileId].slice(0, 4));
  }

  function create() {
    try {
      const profile = createHeroProfile({ name, race, classId, portraitVariant });
      onCreate(profile);
      if (selectedIds.length < 4) onSelectionChange([...selectedIds, profile.id]);
      setName("");
      setCreationError("");
    } catch (error) { setCreationError(error instanceof Error ? error.message : "Nie udało się utworzyć bohatera."); }
  }

  return <div className="hero-profile-workshop">
    <div className="saved-hero-roster">
      {profiles.map((profile) => {
        const selected = selectedIds.includes(profile.id);
        const heroClass = heroClassById.get(profile.classId)!;
        const raceDefinition = races.find((candidate) => candidate.id === profile.race)!;
        const pending = pendingProgressionLevels(profile);
        const nextThreshold = profile.level < 5 ? XP_THRESHOLDS[profile.level] : undefined;
        return <article className={`saved-hero-card ${selected ? "selected" : ""}`} key={profile.id}>
          <button aria-pressed={selected} className="saved-hero-summary" onClick={() => toggle(profile.id)} type="button">
            <UnitPortrait definitionId={profile.classId} variant={profile.portraitVariant} label={`Portret ${profile.name}`} />
            <span><strong>{profile.name}</strong><small>{raceDefinition.name} · {heroClass.name}</small><em>Poziom {profile.level} · {profile.xp} XP{nextThreshold ? ` / ${nextThreshold}` : " · maksimum"}</em></span><b>{selected ? "✓" : "+"}</b>
          </button>
          {pending.map((level) => <div className="level-choice" key={level}><span>AWANS · POZIOM {level}</span><p>Wybierz zdolność albo talent:</p>{progressionOptions(profile.classId, level).map((option) => <button key={option.id} onClick={() => onUpdate(chooseProgressionOption(profile, option.id))} title={option.description} type="button"><strong>{option.name}</strong><small>{option.kind === "ability" ? "ZDOLNOŚĆ" : "TALENT"} · {option.description}</small></button>)}</div>)}
        </article>;
      })}
    </div>

    <aside className="hero-creator">
      <div><span>NOWY PROFIL</span><h3>Stwórz bohatera</h3><p>Profil pozostanie w kronice między kolejnymi bitwami.</p></div>
      <div className="progression-rules"><strong>PROGRESJA 1–5</strong><small>Każdy kolejny poziom: +2 HP. Poziomy 3 i 5: dodatkowo +1 do ataku. Na poziomach 2, 3 i 5 wybierasz zdolność lub talent.</small></div>
      <label>Imię<input placeholder="Np. Tordek" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Rasa<select value={race} onChange={(event) => setRace(event.target.value as RaceId)}>{races.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><small>{races.find((option) => option.id === race)?.description}</small></label>
      <label>Klasa<select value={classId} onChange={(event) => { setClassId(event.target.value); setPortraitVariant(0); }}>{heroClasses.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Portret<div className="creator-portrait-picker"><button aria-label="Poprzedni wariant portretu" onClick={() => changePortrait(-1)} type="button">←</button><div><UnitPortrait definitionId={classId} variant={portraitVariant} /><small>WARIANT {portraitVariant + 1} / {portraitCount}</small></div><button aria-label="Następny wariant portretu" onClick={() => changePortrait(1)} type="button">→</button></div></label>
      {creationError && <small className="creator-error">{translateError(creationError)}</small>}
      <button className="create-hero-button" onClick={create} type="button">Zapisz bohatera</button>
    </aside>
  </div>;
}

function translateError(error: string): string {
  if (error.includes("at least two")) return "Imię musi mieć co najmniej 2 znaki.";
  return error;
}
