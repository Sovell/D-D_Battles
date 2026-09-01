import { heroClassById } from "../data/heroes";
import { monsterById } from "../data/monsters";
import type { BattleState, Combatant, HeroClassDefinition, MonsterDefinition, ScenarioDefinition } from "../domain/types";
import { generateCrypt } from "../map-generation/crypt-generator";
import { generateRuins } from "../map-generation/ruins-generator";
import { createRandom } from "../random/random";

export function createBattle(seed: number, scenario: ScenarioDefinition, heroIds = ["fighter", "rogue", "cleric", "wizard"]): BattleState {
  if (scenario.theme === "cave") throw new Error("Theme cave is not implemented yet");
  const map = scenario.theme === "ruins" ? generateRuins(seed) : generateCrypt(seed);
  const random = createRandom(seed + scenario.encounter.seedOffset);
  const heroes = heroIds.map((id, index) => toHero(heroClassById.get(id)!, `hero-${id}`, map.heroStart[index], random.int(1, 20)));
  const enemies = scenario.encounter.monsters.map((id, index) => toMonster(monsterById.get(id)!, `monster-${index}-${id}`, map.monsterStart[index], random.int(1, 20)));
  const combatants = [...heroes, ...enemies];
  const initiativeOrder = [...combatants].sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)).map((unit) => unit.id);
  return {
    seed, randomState: random.state, scenario, map, combatants, initiativeOrder, activeIndex: 0, round: 1,
    objectives: scenario.victoryCondition === "destroy-foci-and-undead" ? map.objectives.map((objective) => ({ ...objective, maxHp: objective.hp })) : [], outcome: "active",
    log: [{ id: 1, text: `Ekspedycja ${seed}. Inicjatywa została ustalona.`, kind: "system" }],
  };
}

function toHero(definition: HeroClassDefinition, id: string, position: Combatant["position"], roll: number): Combatant {
  return { id, definitionId: definition.id, name: definition.name, side: "heroes", position, hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves, speed: definition.speed, initiativeBonus: definition.initiative, initiative: roll + definition.initiative, attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: definition.maxCharges, cooldowns: {}, statuses: [], resistances: [], tags: ["hero"], moved: false, acted: false };
}
function toMonster(definition: MonsterDefinition, id: string, position: Combatant["position"], roll: number): Combatant {
  return { id, definitionId: definition.id, name: definition.name, side: "monsters", position, hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves, speed: definition.speed, initiativeBonus: definition.initiative, initiative: roll + definition.initiative, attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: 0, cooldowns: {}, statuses: [], doctrine: definition.doctrine, resistances: definition.resistances ?? [], tags: definition.tags ?? [], moved: false, acted: false };
}
