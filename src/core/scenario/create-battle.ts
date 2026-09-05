import { monsterById } from "../data/monsters";
import type { BattleState, Combatant, HeroLoadout, HeroProfile, MonsterDefinition, ScenarioDefinition } from "../domain/types";
import { generateCrypt } from "../map-generation/crypt-generator";
import { generateRuins } from "../map-generation/ruins-generator";
import { createLegacyHeroProfile, createLegacyRoster, heroBattleStats } from "../progression/hero-progression";
import { deriveCombatStats, spellSaveDc } from "../progression/derived-combat-stats";
import { createRandom } from "../random/random";
import { resolveScenarioEvents } from "./scenario-events";
import { starterLoadoutForClass } from "../equipment/campaign";
import { itemAbilities } from "../equipment/battle-equipment";
import { weaponSwitchAbility, weaponTechniqueForLoadout } from "../equipment/weapon-attacks";

export function createBattle(seed: number, scenario: ScenarioDefinition, heroSelection: readonly (HeroProfile | string)[] = createLegacyRoster(), heroVariants: Record<string, number> = {}, heroLoadouts: Record<string, HeroLoadout> = {}): BattleState {
  if (scenario.theme === "cave") throw new Error("Theme cave is not implemented yet");
  const heroSnapshots = heroSelection.map((hero) => typeof hero === "string" ? createLegacyHeroProfile(hero, heroVariants[hero] ?? 0) : structuredClone(hero));
  const map = scenario.map ? structuredClone(scenario.map) : scenario.theme === "ruins" ? generateRuins(seed) : generateCrypt(seed);
  const random = createRandom(seed + scenario.encounter.seedOffset);
  if (map.heroStart.length < heroSnapshots.length) throw new Error("Map does not have enough hero start cells");
  const monsterStarts = allocateMonsterStarts(map, scenario.encounter.monsters.length, heroSnapshots.length);
  const loadoutSnapshots = Object.fromEntries(heroSnapshots.map((profile) => [profile.id, structuredClone(heroLoadouts[profile.id] ?? starterLoadoutForClass(profile.classId))]));
  const heroes = heroSnapshots.map((profile, index) => toHero(profile, loadoutSnapshots[profile.id], map.heroStart[index], random.int(1, 20)));
  const enemies = scenario.encounter.monsters.map((id, index) => toMonster(monsterById.get(id)!, `monster-${index}-${id}`, monsterStarts[index], random.int(1, 20)));
  const combatants = [...heroes, ...enemies];
  const initiativeOrder = [...combatants].sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id)).map((unit) => unit.id);
  const state: BattleState = {
    seed, randomState: random.state, scenario, map, combatants, initiativeOrder, activeIndex: 0, round: 1,
    objectives: map.objectives.map((objective) => ({ ...objective, maxHp: objective.hp })), outcome: "active",
    log: [{ id: 1, text: `Ekspedycja ${seed}. Inicjatywa została ustalona.`, kind: "system" }],
    resolvedEventIds: [], pendingEventNotices: [], heroSnapshots: structuredClone(heroSnapshots), heroLoadoutSnapshots: structuredClone(loadoutSnapshots), spentItemCharges: {}, progressionRewardClaimed: false, traps: [],
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

function toHero(profile: HeroProfile, loadout: HeroLoadout, position: Combatant["position"], roll: number): Combatant {
  const definition = heroBattleStats(profile);
  const derived = deriveCombatStats(profile, loadout);
  const switchAbility = weaponSwitchAbility(profile.classId, loadout);
  const abilities = definition.abilities.map((ability) => {
    const dc = ability.save ? spellSaveDc(profile, ability.saveDc?.rank ?? 1, ability.saveDc?.ability) : undefined;
    const castingAbility = ability.saveDc?.ability ?? definition.castingAbility;
    const dcAbility = dc ? { ...ability, source: ability.kind === "attack" ? "spell-attack" as const : "spell-save" as const, saveDcOverride: dc, description: `${ability.description.replace(/ST 13/g, `ST ${dc}`)} ST ${dc} = 10 + ranga ${ability.saveDc?.rank ?? 1} + ${castingAbility ?? "brak cechy"}.` } : ability;
    return weaponTechniqueForLoadout(dcAbility, { ...definition, abilityScores: derived.abilityScores }, profile.level, loadout, profile.selectedAbilityIds.includes("talent-accuracy") ? 1 : 0);
  });
  return { id: `hero-${profile.id}`, definitionId: definition.id, name: profile.name, side: "heroes", position, hp: derived.maxHp, maxHp: derived.maxHp, defenseClass: derived.defenseClass, saves: derived.saves, speed: derived.speed, initiativeBonus: derived.initiative, initiative: roll + derived.initiative, attackBonus: derived.attackBonus, abilityScores: derived.abilityScores, derivedStats: derived, basicAttack: derived.basicAttack, abilities: [...abilities, ...itemAbilities(loadout), ...(switchAbility ? [switchAbility] : [])], charges: derived.maxCharges, maxCharges: derived.maxCharges, cooldowns: {}, statuses: [], resistances: [], tags: ["hero", `class-${profile.classId}`, `race-${profile.race}`, `level-${profile.level}`], artVariant: profile.portraitVariant, moved: false, acted: false };
}
function toMonster(definition: MonsterDefinition, id: string, position: Combatant["position"], roll: number): Combatant {
  return { id, definitionId: definition.id, name: definition.name, side: "monsters", position, hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves, speed: definition.speed, initiativeBonus: definition.initiative, initiative: roll + definition.initiative, attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: 0, maxCharges: 0, cooldowns: {}, statuses: [], doctrine: definition.doctrine, resistances: definition.resistances ?? [], tags: definition.tags ?? [], artVariant: 0, moved: false, acted: false };
}

function key(position: Combatant["position"]): string { return `${position.x},${position.y}`; }
function nearestDistance(position: Combatant["position"], anchors: Combatant["position"][]): number { return Math.min(...anchors.map((anchor) => Math.abs(position.x - anchor.x) + Math.abs(position.y - anchor.y))); }
