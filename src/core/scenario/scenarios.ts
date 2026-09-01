import type { ScenarioDefinition } from "../domain/types";

export const cleanseTheCrypt: ScenarioDefinition = {
  id: "cleanse-the-crypt",
  name: "Oczyść kryptę",
  description: "Rozbij nekromantyczne ogniska i połóż kres nieumarłym.",
  objectiveText: "Zniszcz 2 ogniska i pokonaj wszystkich nieumarłych.",
  theme: "crypt",
  encounter: { id: "crypt-awakening", name: "Przebudzenie krypty", monsters: ["skeleton", "skeleton", "ghoul", "giant-spider", "goblin"], seedOffset: 91 },
  victoryCondition: "destroy-foci-and-undead",
};

export const interruptTheRitual: ScenarioDefinition = {
  id: "interrupt-the-ritual",
  name: "Przerwany rytuał",
  description: "Przedrzyj się przez ruiny i pokonaj rytualistę, zanim zakończy inkantację.",
  objectiveText: "Pokonaj rytualistę przed końcem 8. rundy.",
  theme: "ruins",
  encounter: { id: "ritual-at-the-broken-seal", name: "Rytuał przy pękniętej pieczęci", monsters: ["ritualist", "skeleton", "skeleton", "ghoul", "goblin"], seedOffset: 201 },
  victoryCondition: "defeat-ritualist",
  roundLimit: 8,
};
export const escapeTheLair: ScenarioDefinition = { id: "escape-the-lair", name: "Ucieczka z legowiska", description: "Zdobądź artefakt i ewakuuj bohaterów.", objectiveText: "W przygotowaniu po vertical slice.", theme: "cave", encounter: { id: "lair", name: "Legowisko", monsters: [], seedOffset: 301 }, victoryCondition: "escape-with-artifact" };
