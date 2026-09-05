import type { SavedScenario } from "../domain/types";
import type { CampaignDefinition, CampaignNode } from "./campaign-wings";
import { generateScenarioMap } from "../map-generation/scenario-map";

export function fracturedSealCampaign(): CampaignDefinition {
  const now = "2026-09-05T00:00:00.000Z";
  const node = (id: string, name: string, theme: SavedScenario["encounterThemeId"], monsters: string[], seed: number, kind: CampaignNode["kind"], flags: string[]): CampaignNode => {
    const scenarioSnapshot: SavedScenario = { schemaVersion: 1, id: `seal-${id}`, name, description: kind === "boss" ? "Dwa fragmenty otwierają drogę do rytualisty. Przerwij ceremonię i zamknij pękniętą pieczęć." : "Oczyść skrzydło i odzyskaj część pieczęci. Po misji wróć do schronienia, aby przygotować drużynę.", localAuthor: "D&D Battles", createdAt: now, presetId: kind === "boss" ? "ritual-disruption" : "skirmish", encounterThemeId: theme, aiSettings: { enabled: true, doctrine: "adaptive" }, encounterBudget: 70, monsterIds: monsters, persistentRewards: true, mapMode: "fixed", baseSeed: seed, mapEnvironment: theme === "goblin-raid" ? "outdoor" : "dungeon", map: generateScenarioMap(seed, theme === "goblin-raid" ? "outdoor" : "dungeon", false), events: [] };
    return { id, name, kind, scenarioSnapshot, prerequisites: kind === "boss" ? { requiredFlags: ["outer-gate-key", "seal-fragment"] } : {}, grantsFlags: flags, displayOrder: seed - 6100, ...(kind === "boss" ? { milestoneReward: { guaranteedItemIds: ["cloak-resistance-2"] } } : {}) };
  };
  return { schemaVersion: 1, id: "fractured-seal", name: "Pęknięta Pieczęć", description: "Dwa niezależne skrzydła skrywają klucz i fragment pieczęci. Przygotuj drużynę w schronieniu, a potem przerwij finałowy rytuał.", suggestedLevel: { min: 1, max: 3 }, createdAt: now, updatedAt: now, nodes: [node("outer-gate", "Najeźdźcy z przedmurza", "goblin-raid", ["goblin", "goblin", "worg", "hobgoblin-captain"], 6101, "wing", ["outer-gate-key"]), node("bones", "Krypta kości", "undead-crypt", ["skeleton", "skeleton", "zombie", "ghoul"], 6102, "wing", ["seal-fragment"]), node("broken-seal", "Zerwana pieczęć", "fiendish-ritual", ["ritualist", "harpy", "wraith"], 6103, "boss", [])] };
}
