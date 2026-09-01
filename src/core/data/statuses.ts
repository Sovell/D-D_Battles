import type { StatusEffectDefinition } from "../domain/types";

export const statusEffects: StatusEffectDefinition[] = [
  { id: "poisoned", name: "Poisoned", description: "1 obrażenie i -1 do ataku na początku aktywacji." },
  { id: "burning", name: "Burning", description: "2 obrażenia od ognia na początku aktywacji." },
  { id: "frightened", name: "Frightened", description: "-2 do ataku." },
  { id: "prone", name: "Prone", description: "Szybkość zmniejszona o 2." },
  { id: "stunned", name: "Stunned", description: "Pomija akcję." },
  { id: "webbed", name: "Webbed", description: "Szybkość zmniejszona do 1." },
  { id: "regenerating", name: "Regenerating", description: "Odzyskuje 2 HP na początku aktywacji." },
  { id: "guarded", name: "Guarded", description: "+2 Defense Class." },
  { id: "blessed", name: "Blessed", description: "+1 do ataku." },
];

