import type { DungeonMap, ScenarioCondition, ScenarioDefinition, ScenarioTemplateDefinition, ScenarioTemplateId } from "../domain/types";

const intro = (id: string, name: string, text: string) => ({ id: `${id}-intro`, name, trigger: { type: "battle-start" as const }, effect: { type: "show-message" as const, text } });

export const scenarioTemplates: ScenarioTemplateDefinition[] = [
  { id: "skirmish", name: "Skirmish", description: "Klasyczne starcie z wybranym oddziałem przeciwników.", objectiveText: "Pokonaj wszystkich przeciwników.", failureText: "Cała drużyna poległa.", suggestedLevel: { min: 1, max: 2 }, rewardXp: 100, environment: "dungeon", theme: "crypt", monsters: ["orc-brute", "goblin", "goblin", "bugbear-ambusher"], requiresObjectives: false, events: [intro("skirmish", "Pierwsze starcie", "Wrogowie zajęli pozycje. Oczyść pole bitwy.")] },
  { id: "hold-the-line", name: "Hold the Line", description: "Przetrwaj napór kolejnych fal do nadejścia wsparcia.", objectiveText: "Utrzymaj linię do początku 7. rundy.", failureText: "Drużyna została rozbita przed nadejściem wsparcia.", suggestedLevel: { min: 2, max: 3 }, rewardXp: 160, roundLimit: 6, environment: "outdoor", theme: "ruins", monsters: ["zombie", "zombie", "worg"], requiresObjectives: false, events: [intro("hold", "Nadciąga fala", "Wytrzymajcie sześć pełnych rund."), { id: "hold-wave-two", name: "Druga fala", trigger: { type: "round-start", round: 4 }, effect: { type: "spawn-monsters", monsterIds: ["zombie", "orc-brute"] } }] },
  { id: "breakthrough", name: "Breakthrough", description: "Przebij się przez blokadę i doprowadź bohatera do strefy wyjścia.", objectiveText: "Co najmniej jeden bohater musi dotrzeć do strefy wyjścia przed końcem 8. rundy.", failureText: "Droga odwrotu została odcięta.", suggestedLevel: { min: 1, max: 3 }, rewardXp: 140, roundLimit: 8, environment: "outdoor", theme: "ruins", monsters: ["hobgoblin-captain", "goblin", "goblin", "worg"], requiresObjectives: false, events: [intro("breakthrough", "Przerwij blokadę", "Wyjście znajduje się za linią przeciwnika."), { id: "breakthrough-reinforcements", name: "Pościg", trigger: { type: "round-start", round: 5 }, effect: { type: "spawn-monsters", monsterIds: ["dire-wolf"] } }] },
  { id: "assassinate", name: "Assassinate", description: "Wyeliminuj dowódcę, zanim zdąży sprowadzić posiłki.", objectiveText: "Pokonaj Hobgoblin Captaina przed końcem 7. rundy.", failureText: "Dowódca zakończył mobilizację wojsk.", suggestedLevel: { min: 2, max: 3 }, rewardXp: 180, roundLimit: 7, environment: "interior", theme: "ruins", monsters: ["hobgoblin-captain", "bugbear-ambusher", "orc-brute", "goblin"], requiresObjectives: false, events: [intro("assassinate", "Cel: dowódca", "Eskorta nie ma znaczenia, jeśli dowódca upadnie."), { id: "captain-alarm", name: "Alarm", trigger: { type: "round-start", round: 4 }, effect: { type: "spawn-monsters", monsterIds: ["goblin", "goblin"] } }] },
  { id: "rescue", name: "Rescue", description: "Rozbij więzienne pieczęcie i uwolnij jeńców.", objectiveText: "Zniszcz wszystkie więzienne pieczęcie przed końcem 9. rundy.", failureText: "Jeńcy zostali wyprowadzeni poza zasięg drużyny.", suggestedLevel: { min: 2, max: 4 }, rewardXp: 190, roundLimit: 9, environment: "interior", theme: "crypt", monsters: ["bugbear-ambusher", "orc-brute", "worg", "worg"], requiresObjectives: true, events: [intro("rescue", "Jeńcy", "Pieczęcie można atakować jak inne cele na mapie."), { id: "rescue-guards", name: "Zmiana warty", trigger: { type: "round-start", round: 5 }, effect: { type: "spawn-monsters", monsterIds: ["hobgoblin-captain"] } }] },
  { id: "ritual-disruption", name: "Ritual Disruption", description: "Przedrzyj się przez eskortę i przerwij inkantację.", objectiveText: "Pokonaj rytualistę przed końcem 8. rundy.", failureText: "Rytuał został ukończony.", suggestedLevel: { min: 1, max: 3 }, rewardXp: 140, roundLimit: 8, environment: "outdoor", theme: "ruins", monsters: ["ritualist", "skeleton", "skeleton", "ghoul", "zombie"], requiresObjectives: false, events: [intro("ritual", "Rytuał przy pękniętej pieczęci", "Macie osiem rund, aby pokonać rytualistę."), { id: "ritual-pressure", name: "Pękająca pieczęć", trigger: { type: "round-start", round: 5 }, effect: { type: "change-objective", text: "Pozostały cztery rundy. Skupcie ataki na rytualiście." } }] },
  { id: "escape", name: "Escape", description: "Wyprowadź całą ocalałą drużynę ze strefy zagrożenia.", objectiveText: "Wszyscy żywi bohaterowie muszą wejść do strefy wyjścia przed końcem 8. rundy.", failureText: "Przejście zawaliło się, odcinając drogę ucieczki.", suggestedLevel: { min: 3, max: 5 }, rewardXp: 210, roundLimit: 8, environment: "dungeon", theme: "cave", monsters: ["troll", "dire-wolf", "dire-wolf"], requiresObjectives: false, events: [intro("escape", "Droga ucieczki", "Zbierz drużynę w oznaczonej strefie za linią wroga."), { id: "escape-collapse", name: "Walący się tunel", trigger: { type: "round-start", round: 5 }, effect: { type: "spawn-monsters", monsterIds: ["wraith"] } }] },
  { id: "treasure-run", name: "Treasure Run", description: "Zdobądź skarby i wynieś je przez strefę wyjścia.", objectiveText: "Otwórz wszystkie skrytki i doprowadź bohatera do strefy wyjścia.", failureText: "Skarbiec został zapieczętowany.", suggestedLevel: { min: 3, max: 5 }, rewardXp: 240, roundLimit: 10, environment: "dungeon", theme: "crypt", monsters: ["minotaur", "manticore", "wraith"], requiresObjectives: true, events: [intro("treasure", "Skarbiec", "Skrytki można atakować, aby je otworzyć."), { id: "treasure-guardian", name: "Strażnik skarbca", trigger: { type: "round-start", round: 6 }, effect: { type: "spawn-monsters", monsterIds: ["troll"] } }] },
];

export const scenarioTemplateById = new Map(scenarioTemplates.map((template) => [template.id, template]));

export function buildScenarioTemplate(templateId: ScenarioTemplateId, map: DungeonMap, name?: string): ScenarioDefinition {
  const template = scenarioTemplateById.get(templateId);
  if (!template) throw new Error(`Unknown scenario template: ${templateId}`);
  const exit = map.monsterStart.at(-1) ?? map.cells.filter((cell) => cell.terrain !== "wall").at(-1)?.position ?? { x: map.width - 1, y: map.height - 1 };
  const victoryRules = createVictoryRules(templateId, exit);
  return {
    id: `custom-${template.id}-${map.seed}`,
    templateId: template.id,
    name: name?.trim() || template.name,
    description: template.description,
    objectiveText: template.objectiveText,
    failureText: template.failureText,
    objectiveLabel: templateId === "rescue" ? "więzienną pieczęć" : templateId === "treasure-run" ? "skrytkę" : "cel",
    theme: map.theme,
    encounter: { id: `${template.id}-${map.seed}`, name: template.name, monsters: [...template.monsters], seedOffset: template.id.length * 37 },
    victoryCondition: templateId === "ritual-disruption" ? "defeat-ritualist" : "template-rules",
    victoryRules,
    defeatRules: template.roundLimit ? { type: "round-exceeded", round: template.roundLimit } : undefined,
    roundLimit: template.roundLimit,
    rewardXp: template.rewardXp,
    events: structuredClone(template.events),
    map: structuredClone(map),
  };
}

function createVictoryRules(id: ScenarioTemplateId, exit: { x: number; y: number }): ScenarioCondition {
  if (id === "hold-the-line") return { type: "survive-until-round", round: 7 };
  if (id === "breakthrough") return { type: "side-in-zone", side: "heroes", center: exit, radius: 1, required: 1 };
  if (id === "assassinate") return { type: "unit-defeated", definitionId: "hobgoblin-captain" };
  if (id === "rescue") return { type: "objectives-destroyed" };
  if (id === "ritual-disruption") return { type: "unit-defeated", definitionId: "ritualist" };
  if (id === "escape") return { type: "side-in-zone", side: "heroes", center: exit, radius: 1, required: "all" };
  if (id === "treasure-run") return { type: "all", conditions: [{ type: "objectives-destroyed" }, { type: "side-in-zone", side: "heroes", center: exit, radius: 1, required: 1 }] };
  return { type: "all-monsters-defeated" };
}
