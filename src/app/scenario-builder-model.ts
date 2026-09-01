import { heroClasses } from "../core/data/heroes";
import { monsters } from "../core/data/monsters";
import type { ScenarioDefinition } from "../core/domain/types";
import { cleanseTheCrypt, interruptTheRitual } from "../core/scenario/scenarios";

export type SupportedScenarioPresetId = "cleanse-the-crypt" | "interrupt-the-ritual";

export interface ScenarioDraft {
  presetId: SupportedScenarioPresetId;
  name: string;
  seed: number;
  heroIds: string[];
  monsterIds: string[];
}

export const availableHeroIds = heroClasses.map((hero) => hero.id);
export const availableMonsterIds = monsters.filter((monster) => monster.id !== "owlbear").map((monster) => monster.id);

export function createDefaultScenarioDraft(seed = 3535): ScenarioDraft {
  return {
    presetId: "cleanse-the-crypt",
    name: cleanseTheCrypt.name,
    seed,
    heroIds: ["fighter", "rogue", "cleric", "wizard"],
    monsterIds: [...cleanseTheCrypt.encounter.monsters],
  };
}

export function selectScenarioPreset(draft: ScenarioDraft, presetId: SupportedScenarioPresetId): ScenarioDraft {
  const preset = presetId === "interrupt-the-ritual" ? interruptTheRitual : cleanseTheCrypt;
  return { ...draft, presetId, name: preset.name, monsterIds: [...preset.encounter.monsters] };
}

export function validateScenarioDraft(draft: ScenarioDraft): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(draft.seed)) errors.push("Seed musi być liczbą całkowitą.");
  if (draft.name.trim().length < 3) errors.push("Nazwa scenariusza musi mieć co najmniej 3 znaki.");
  if (draft.heroIds.length < 3 || draft.heroIds.length > 4) errors.push("Drużyna musi mieć 3–4 bohaterów.");
  if (new Set(draft.heroIds).size !== draft.heroIds.length) errors.push("Nie można wybrać tej samej klasy dwa razy.");
  if (draft.heroIds.some((id) => !availableHeroIds.includes(id))) errors.push("Drużyna zawiera nieznaną klasę.");
  if (draft.monsterIds.length < 1 || draft.monsterIds.length > 5) errors.push("Spotkanie musi zawierać 1–5 potworów.");
  if (draft.monsterIds.some((id) => !availableMonsterIds.includes(id))) errors.push("Spotkanie zawiera nieznanego potwora.");
  if (draft.presetId === "interrupt-the-ritual" && draft.monsterIds.filter((id) => id === "ritualist").length !== 1) errors.push("Scenariusz rytuału wymaga dokładnie jednego rytualisty.");
  return errors;
}

export function buildScenarioFromDraft(draft: ScenarioDraft): ScenarioDefinition {
  const errors = validateScenarioDraft(draft);
  if (errors.length) throw new Error(errors.join(" "));
  const preset = draft.presetId === "interrupt-the-ritual" ? interruptTheRitual : cleanseTheCrypt;
  return {
    ...preset,
    name: draft.name.trim(),
    encounter: {
      ...preset.encounter,
      id: `custom-${draft.presetId}-${draft.seed}`,
      name: draft.presetId === "interrupt-the-ritual" ? "Rytualista i wybrana eskorta" : "Własne spotkanie w krypcie",
      monsters: [...draft.monsterIds],
    },
  };
}

export function setMonsterCount(draft: ScenarioDraft, monsterId: string, count: number): ScenarioDraft {
  const retained = draft.monsterIds.filter((id) => id !== monsterId);
  const desired = Math.max(0, Math.floor(count));
  return { ...draft, monsterIds: [...retained, ...Array.from({ length: desired }, () => monsterId)].slice(0, 5) };
}
