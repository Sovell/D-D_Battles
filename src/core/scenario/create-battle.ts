import { heroClassById } from "../data/heroes";
import { monsterById } from "../data/monsters";
import type { BattleState, Combatant, HeroClassDefinition, MonsterDefinition, ScenarioDefinition } from "../domain/types";
import { generateCrypt } from "../map-generation/crypt-generator";
import { generateRuins } from "../map-generation/ruins-generator";
import { createRandom } from "../random/random";
import { resolveScenarioEvents } from "./scenario-events";

export function createBattle(seed: number, scenario: ScenarioDefinition, heroIds = ["fighter", "rogue", "cleric", "wizard"], heroVariants: Record<string, number> = {}): BattleState {
  if (scenario.theme === "cave") throw new Error("Theme cave is not implemented yet");
  const map = scenario.map ? structuredClone(scenario.map) : scenario.theme === "ruins" ? generateRuins(seed) : generateCrypt(seed);
  const random = createRandom(seed + scenario.encounter.seedOffset);
  if (map.heroStart.length < heroIds.length) throw new Error("Map does not have enough hero start cells");
  const monsterStarts = allocateMonsterStarts(map, scenario.encounter.monsters.length, heroIds.length);
  const heroes = heroIds.map((id, index) => toHero(heroClassById.get(id)!, `hero-${id}`, map.heroStart[index], random.int(1, 20), heroVariants[id] ?? 0));
  const enemies = scenario.encounter.monsters.map((id, index) => toMonster(monsterById.get(id)!, `monster-${index}-${id}`, monsterStarts[index], random.int(1, 20)));
  const combatants = [...heroes, ...enemies];
  const initiativeOrder = [...combatants].sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)).map((unit) => unit.id);
  const state: BattleState = {
    seed, randomState: random.state, scenario, map, combatants, initiativeOrder, activeIndex: 0, round: 1,
    objectives: scenario.victoryCondition === "destroy-foci-and-undead" ? map.objectives.map((objective) => ({ ...objective, maxHp: objective.hp })) : [], outcome: "active",
    log: [{ id: 1, text: `Ekspedycja ${seed}. Inicjatywa została ustalona.`, kind: "system" }],
    resolvedEventIds: [], pendingEventNotices: [],
  };
  return resolveScenarioEvents(state, [{ type: "battle-start" }, { type: "round-start", round: 1 }]);
}

export function allocateMonsterStarts(map: BattleState["map"], count: number, heroCount = 4): Combatant["position"][] {
  const blocked = new Set([
    ...map.heroStart.slice(0, heroCount).map(key),
    ...map.objectives.map((objective) => key(objective.position)),
  ]);
  const legal = map.cells.filter((cell) => cell.terrain !== "wall" && !blocked.has(key(cell.position)));
  const preferred = map.monsterStart.filter((position, index, positions) => legal.some((cell) => key(cell.position) === key(position)) && positions.findIndex((candidate) => key(candidate) === key(position)) === index);
  const anchors = preferred.length ? preferred : legal.slice(-1).map((cell) => cell.position);
  const remaining = legal.map((cell) => cell.position).filter((position) => !preferred.some((candidate) => key(candidate) === key(position)))
    .sort((left, right) => nearestDistance(left, anchors) - nearestDistance(right, anchors) || left.y - right.y || left.x - right.x);
  const positions = [...preferred, ...remaining].slice(0, count);
  if (positions.length < count) throw new Error("Map does not have enough legal cells for all monsters");
  return positions;
}

function toHero(definition: HeroClassDefinition, id: string, position: Combatant["position"], roll: number, artVariant: number): Combatant {
  return { id, definitionId: definition.id, name: definition.name, side: "heroes", position, hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves, speed: definition.speed, initiativeBonus: definition.initiative, initiative: roll + definition.initiative, attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: definition.maxCharges, cooldowns: {}, statuses: [], resistances: [], tags: ["hero"], artVariant: Math.max(0, Math.min(2, Math.floor(artVariant))), moved: false, acted: false };
}
function toMonster(definition: MonsterDefinition, id: string, position: Combatant["position"], roll: number): Combatant {
  return { id, definitionId: definition.id, name: definition.name, side: "monsters", position, hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves, speed: definition.speed, initiativeBonus: definition.initiative, initiative: roll + definition.initiative, attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: 0, cooldowns: {}, statuses: [], doctrine: definition.doctrine, resistances: definition.resistances ?? [], tags: definition.tags ?? [], artVariant: 0, moved: false, acted: false };
}

function key(position: Combatant["position"]): string { return `${position.x},${position.y}`; }
function nearestDistance(position: Combatant["position"], anchors: Combatant["position"][]): number { return Math.min(...anchors.map((anchor) => Math.abs(position.x - anchor.x) + Math.abs(position.y - anchor.y))); }
