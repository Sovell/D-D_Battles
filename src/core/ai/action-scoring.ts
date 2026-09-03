import type { AbilityDefinition, ActionTarget, BattleState, Combatant, GridPosition } from "../domain/types";
import { monsterById } from "../data/monsters";
import { activeCombatant, endActivation, getLegalTargets, moveCombatant, resolveAbility } from "../rules/combat";
import { terrainAt } from "../rules/line-of-sight";
import { distance, findPath, getReachableCells, positionKey } from "../rules/pathfinding";
import type { AiAction, AiCandidate, AiIntent, ScenarioAiPlan } from "./ai-types";
import { getScenarioAiPlan, scenarioGoal } from "./scenario-ai-plan";

export type { AiAction, AiCandidate, AiIntent, ScenarioAiPlan } from "./ai-types";
export { getScenarioAiPlan } from "./scenario-ai-plan";

interface AiContext {
  actor: Combatant;
  heroes: Combatant[];
  allies: Combatant[];
  plan: ScenarioAiPlan;
  goal?: GridPosition;
  post?: GridPosition;
  protectedUnit?: Combatant;
  preferredTarget?: Combatant;
}

export function chooseAiAction(state: BattleState): AiAction {
  return chooseAiCandidate(state)?.action ?? { kind: "end" };
}

export function chooseAiCandidate(state: BattleState): AiCandidate | undefined {
  const candidates = evaluateAiCandidates(state);
  if (!candidates.length) return undefined;
  const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
  return candidates.filter((candidate) => Math.abs(candidate.score - bestScore) < 0.001).sort((left, right) => right.tieBreaker - left.tieBreaker)[0];
}

export function evaluateAiCandidates(state: BattleState): AiCandidate[] {
  const actor = activeCombatant(state);
  if (!actor || actor.side !== "monsters" || actor.hp <= 0 || state.outcome !== "active") return [];
  const context = createContext(state, actor);
  const candidates: AiCandidate[] = [];
  for (const ability of [actor.basicAttack, ...actor.abilities]) {
    for (const target of getLegalTargets(state, actor.id, ability.id)) {
      const scored = scoreAbility(state, context, ability, target);
      candidates.push(candidate(state, actor, { kind: "attack", abilityId: ability.id, target }, scored.intent, scored.score, scored.reasons));
    }
  }
  for (const position of getReachableCells(state, actor.id)) {
    const scored = scoreMove(state, context, position);
    candidates.push(candidate(state, actor, { kind: "move", position }, scored.intent, scored.score, scored.reasons));
  }
  const held = scoreHold(state, context);
  candidates.push(candidate(state, actor, { kind: "end" }, "hold", held.score, held.reasons));
  return candidates;
}

export function runAiStep(state: BattleState): BattleState {
  const actor = activeCombatant(state);
  if (!actor) return state;
  const action = chooseAiAction(state);
  if (action.kind === "attack") {
    const resolved = resolveAbility(state, actor.id, action.abilityId, action.target);
    const updatedActor = resolved.combatants.find((unit) => unit.id === actor.id);
    return activeCombatant(resolved)?.id === actor.id && !updatedActor?.acted ? endActivation(resolved) : resolved;
  }
  if (action.kind === "move") {
    const moved = moveCombatant(state, actor.id, action.position);
    const updatedActor = moved.combatants.find((unit) => unit.id === actor.id);
    return activeCombatant(moved)?.id === actor.id && !updatedActor?.moved ? endActivation(moved) : moved;
  }
  return endActivation(state);
}

function createContext(state: BattleState, actor: Combatant): AiContext {
  const heroes = state.combatants.filter((unit) => unit.side === "heroes" && unit.hp > 0);
  const allies = state.combatants.filter((unit) => unit.side === "monsters" && unit.hp > 0 && unit.id !== actor.id);
  const plan = getScenarioAiPlan(state);
  const protectedUnit = findProtectedUnit(state, actor);
  const goal = scenarioGoal(state, plan);
  const post = defensivePost(state, actor, plan, goal, protectedUnit);
  return { actor, heroes, allies, plan, goal, post, protectedUnit, preferredTarget: choosePreferredTarget(actor, heroes, allies, goal) };
}

function scoreAbility(state: BattleState, context: AiContext, ability: AbilityDefinition, target: ActionTarget): { intent: AiIntent; score: number; reasons: string[] } {
  const { actor, plan } = context;
  const expectedDamage = ability.damage ? ability.damage.count * (ability.damage.sides + 1) / 2 + (ability.damage.bonus ?? 0) : 0;
  const ranged = ability.kind === "attack" && ability.range > 1;
  const control = ability.kind === "status" || Boolean(ability.status);
  const intent: AiIntent = control ? "useControl" : ranged ? "useRangedAttack" : "engage";
  const reasons = [ability.id === actor.basicAttack.id ? "atak podstawowy" : "zdolność"];
  let score = 42 + expectedDamage * 2;
  const definition = monsterById.get(actor.definitionId);
  score += definition?.tier ?? 0;

  if (target.kind === "cell") {
    const victims = context.heroes.filter((unit) => distance(unit.position, target.position) <= (ability.area ?? 0));
    score += victims.length * (expectedDamage + 12) - (victims.length === 0 ? 80 : 0);
    if (actor.doctrine === "boss") score += victims.length * ({ healthy: 14, wounded: 10, bloodied: 6 }[healthPhase(actor)] + (definition?.tier ?? 0));
    if (actor.definitionId === "young-dragon") score += victims.length * 18;
    reasons.push(`${victims.length} celów w obszarze`);
  } else if (target.kind === "unit") {
    const unit = state.combatants.find((candidate) => candidate.id === target.unitId);
    if (unit?.side === actor.side) {
      score = 25 + (ability.status && !unit.statuses.some((status) => status.id === ability.status) ? 24 : -30);
      if (actor.definitionId === "hobgoblin-captain") score += unit.id === actor.id ? -20 : 45;
      reasons.push("wsparcie sojusznika");
    } else if (unit) {
      score += scoreEnemyTarget(context, unit);
      if (context.preferredTarget?.id === unit.id) score += 18;
      if (plan === "protectTarget" && context.protectedUnit && distance(unit.position, context.protectedUnit.position) <= 3) score += 55;
      if (plan === "interceptCarrier" && isLikelyCarrier(state, unit, context.goal)) score += 65;
      if (actor.definitionId === "worg" && isPackBound(unit, context.allies)) score += 35;
      if (actor.definitionId === "wraith" && isolation(unit, context.heroes) >= 3) score += 35;
      reasons.push(`cel ${unit.name}`);
    }
  }

  if (control && actor.doctrine === "controller") score += 38;
  if (ranged && (actor.doctrine === "ranged" || ["harpy", "manticore"].includes(actor.definitionId))) score += 24;
  if (plan === "delayHeroes" && control) score += 70;
  if (plan === "breakThrough") score -= 55;
  if (actor.definitionId === "ritualist" && control) score += 24;
  return { intent, score, reasons };
}

function scoreMove(state: BattleState, context: AiContext, position: GridPosition): { intent: AiIntent; score: number; reasons: string[] } {
  const { actor, plan, goal, post, preferredTarget } = context;
  const target = preferredTarget;
  const beforeTarget = target ? navigationDistance(state, actor.position, target.position, actor.id, target.id) : 0;
  const afterTarget = target ? navigationDistance(state, position, target.position, actor.id, target.id) : 0;
  let score = 12 + (beforeTarget - afterTarget) * 7;
  let intent: AiIntent = "engage";
  const reasons: string[] = [];

  if (plan === "breakThrough" && goal) {
    score += 75 + (distance(actor.position, goal) - distance(position, goal)) * 30;
    intent = "pursueObjective";
    reasons.push("przełamanie linii");
  } else if (plan === "delayHeroes" && goal && target) {
    const beforeScreen = distance(actor.position, goal) + distance(actor.position, target.position);
    const afterScreen = distance(position, goal) + distance(position, target.position);
    score += 70 + (beforeScreen - afterScreen) * 14;
    intent = effectiveDoctrine(actor) === "controller" ? "useControl" : "screen";
    reasons.push("odcięcie strefy wyjścia");
  } else if ((plan === "defendObjective" || plan === "protectTarget") && post) {
    const before = distance(actor.position, post);
    const after = distance(position, post);
    score += (before - after) * 22 + (after <= defenseRadius(actor) ? 48 : -70);
    intent = actor.id === context.protectedUnit?.id ? "hold" : "screen";
    reasons.push("posterunek obronny");
  } else if (plan === "interceptCarrier" && target) {
    score += 60 + (beforeTarget - afterTarget) * 18;
    intent = "screen";
    reasons.push("przechwycenie celu misji");
  } else if (plan === "escape" && goal) {
    score += 60 + (distance(actor.position, goal) - distance(position, goal)) * 25;
    intent = "retreat";
    reasons.push("odwrót scenariuszowy");
  }

  const doctrine = effectiveDoctrine(actor);
  if (doctrine === "guardian" && post) {
    const radius = defenseRadius(actor);
    const leavingPost = distance(actor.position, post) <= radius && distance(position, post) > radius;
    score += leavingPost ? -150 : Math.max(-40, 35 - distance(position, post) * 18);
    intent = "screen";
    reasons.push("promień obrony");
  }
  if (doctrine === "brute") {
    score += (beforeTarget - afterTarget) * 13 + (isChokePoint(state, position) ? 18 : 0);
    if (monsterById.get(actor.definitionId)?.traits.some((trait) => trait.toLowerCase().includes("knockback")) && afterTarget === 1) score += 16;
    reasons.push("presja w zwarciu");
  }
  if (doctrine === "skirmisher") {
    const flank = context.heroes.some((hero) => isFlankPosition(position, hero, context.allies));
    if (flank) { score += 95; intent = "flank"; reasons.push("pozycja flankująca"); }
    if (actor.acted && target && actorSucceededAttack(state, actor)) { score += (afterTarget - beforeTarget) * 24 + 65; intent = "retreat"; reasons.push("odwrót po udanym ataku"); }
  }
  if (doctrine === "controller" || doctrine === "ranged") {
    const preferred = preferredRange(actor);
    score += 36 - Math.abs(afterTarget - preferred) * 13;
    if (afterTarget <= 1) score -= 130;
    if (beforeTarget <= 1 && afterTarget > 1) score += 140;
    if (terrainAt(state.map, position) === "cover") score += doctrine === "ranged" ? 28 : 12;
    intent = beforeTarget <= 1 && afterTarget > 1 ? "retreat" : afterTarget < preferred ? "retreat" : "screen";
    reasons.push(`dystans optymalny ${preferred}`);
  }
  if (actor.definitionId === "ritualist") {
    const ritualPost = state.map.monsterStart[0] ?? actor.position;
    score += distance(position, ritualPost) <= 1 ? 110 : -220;
    intent = "hold";
    reasons.push("strefa rytuału");
  }
  if (["dire-wolf", "minotaur"].includes(actor.definitionId) && beforeTarget >= 3 && afterTarget < beforeTarget) {
    score += 42;
    intent = "engage";
    reasons.push("najazd do szarży");
  }
  if (actor.doctrine === "boss" && healthPhase(actor) === "bloodied" && afterTarget <= 1) score -= 45;
  return { intent, score, reasons };
}

function scoreHold(state: BattleState, context: AiContext): { score: number; reasons: string[] } {
  const { actor, post, preferredTarget } = context;
  let score = 8;
  const reasons = ["pozostanie na pozycji"];
  if (post && distance(actor.position, post) <= defenseRadius(actor) && effectiveDoctrine(actor) === "guardian") score += 88;
  if (actor.definitionId === "ritualist" && distance(actor.position, state.map.monsterStart[0] ?? actor.position) <= 1) score += 135;
  if ((effectiveDoctrine(actor) === "ranged" || effectiveDoctrine(actor) === "controller") && preferredTarget && Math.abs(distance(actor.position, preferredTarget.position) - preferredRange(actor)) <= 1) score += 40;
  if (actor.acted && effectiveDoctrine(actor) !== "skirmisher") score += 35;
  return { score, reasons };
}

function findProtectedUnit(state: BattleState, actor: Combatant): Combatant | undefined {
  if (state.scenario.templateId === "ritual-disruption" || state.scenario.victoryCondition === "defeat-ritualist") return state.combatants.find((unit) => unit.hp > 0 && unit.tags.includes("ritualist"));
  if (state.scenario.templateId === "assassinate") return state.combatants.find((unit) => unit.hp > 0 && unit.definitionId === "hobgoblin-captain");
  if (actor.definitionId === "hobgoblin-captain") return actor;
}

function defensivePost(state: BattleState, actor: Combatant, plan: ScenarioAiPlan, goal?: GridPosition, protectedUnit?: Combatant): GridPosition | undefined {
  if (actor.definitionId === "ritualist") return state.map.monsterStart[0] ?? actor.position;
  if (plan === "protectTarget" && protectedUnit) return protectedUnit.position;
  if (plan === "defendObjective") return nearestPosition(actor.position, state.objectives.filter((objective) => objective.hp > 0).map((objective) => objective.position)) ?? goal ?? state.map.monsterStart[0];
  if (effectiveDoctrine(actor) === "guardian") return nearestPosition(actor.position, state.objectives.filter((objective) => objective.hp > 0).map((objective) => objective.position)) ?? protectedUnit?.position ?? nearestPosition(actor.position, state.map.monsterStart);
}

function choosePreferredTarget(actor: Combatant, heroes: Combatant[], allies: Combatant[], goal?: GridPosition): Combatant | undefined {
  return [...heroes].sort((left, right) => targetPriority(actor, right, heroes, allies, goal) - targetPriority(actor, left, heroes, allies, goal) || left.id.localeCompare(right.id))[0];
}

function targetPriority(actor: Combatant, target: Combatant, heroes: Combatant[], allies: Combatant[], goal?: GridPosition): number {
  let score = (1 - target.hp / target.maxHp) * 20 - target.defenseClass * 0.25 - distance(actor.position, target.position);
  if (["goblin", "bugbear-ambusher"].includes(actor.definitionId)) score += (1 - target.hp / target.maxHp) * 20;
  if (actor.definitionId === "worg" && isPackBound(target, allies)) score += 35;
  if (actor.definitionId === "wraith") score += isolation(target, heroes) * 10;
  if (goal) score += Math.max(0, 8 - distance(target.position, goal));
  return score;
}

function scoreEnemyTarget(context: AiContext, target: Combatant): number {
  const wounded = 1 - target.hp / target.maxHp;
  const doctrine = effectiveDoctrine(context.actor) === "brute" ? target.maxHp / 8 : effectiveDoctrine(context.actor) === "controller" ? target.abilities.length * 2 : 0;
  return wounded * 22 + doctrine - target.defenseClass * 0.25;
}

function effectiveDoctrine(actor: Combatant): NonNullable<Combatant["doctrine"]> {
  if (["harpy", "manticore"].includes(actor.definitionId)) return "ranged";
  return actor.doctrine ?? "brute";
}

function preferredRange(actor: Combatant): number {
  if (actor.definitionId === "manticore") return 6;
  if (actor.definitionId === "harpy") return 4;
  if (actor.definitionId === "ritualist") return 5;
  return effectiveDoctrine(actor) === "controller" ? 4 : 5;
}

function defenseRadius(actor: Combatant): number { return actor.definitionId === "ritualist" ? 1 : 2; }
function isPackBound(target: Combatant, allies: Combatant[]): boolean { return allies.some((ally) => ["worg", "dire-wolf"].includes(ally.definitionId) && distance(ally.position, target.position) <= 1); }
function isolation(target: Combatant, units: Combatant[]): number { return Math.min(8, ...units.filter((unit) => unit.id !== target.id && unit.side === target.side && unit.hp > 0).map((unit) => distance(unit.position, target.position))); }
function healthPhase(actor: Combatant): "healthy" | "wounded" | "bloodied" { const ratio = actor.hp / actor.maxHp; return ratio > 0.6 ? "healthy" : ratio > 0.3 ? "wounded" : "bloodied"; }
function actorSucceededAttack(state: BattleState, actor: Combatant): boolean { return [...state.log].reverse().find((entry) => entry.kind === "roll" && entry.text.startsWith(`${actor.name}: d20`))?.text.includes("trafienie") ?? false; }
function isLikelyCarrier(state: BattleState, hero: Combatant, goal?: GridPosition): boolean { return state.objectives.some((objective) => objective.hp <= 0) && (!goal || distance(hero.position, goal) <= Math.min(...state.combatants.filter((unit) => unit.side === "heroes" && unit.hp > 0).map((unit) => distance(unit.position, goal)))); }

function isFlankPosition(position: GridPosition, target: Combatant, allies: Combatant[]): boolean {
  if (distance(position, target.position) !== 1) return false;
  const opposite = { x: target.position.x + (target.position.x - position.x), y: target.position.y + (target.position.y - position.y) };
  return allies.some((ally) => positionKey(ally.position) === positionKey(opposite));
}

function isChokePoint(state: BattleState, position: GridPosition): boolean {
  return state.map.cells.filter((cell) => cell.terrain !== "wall" && distance(cell.position, position) === 1).length <= 2;
}

function nearestPosition(origin: GridPosition, positions: GridPosition[]): GridPosition | undefined {
  return [...positions].sort((left, right) => distance(origin, left) - distance(origin, right) || positionKey(left).localeCompare(positionKey(right)))[0];
}

function navigationDistance(state: BattleState, origin: GridPosition, target: GridPosition, actorId: string, targetId: string): number {
  const blocked = new Set(state.combatants.filter((unit) => unit.hp > 0 && unit.id !== actorId && unit.id !== targetId).map((unit) => positionKey(unit.position)));
  const path = findPath(state.map, origin, target, blocked);
  return path ? path.length - 1 : distance(origin, target) + state.map.width + state.map.height;
}

function candidate(state: BattleState, actor: Combatant, action: AiAction, intent: AiIntent, score: number, reasons: string[]): AiCandidate {
  return { action, intent, score, reasons, tieBreaker: seededTieBreaker(state.seed, state.round, actor.id, actionKey(action)) };
}

export function seededTieBreaker(seed: number, round: number, actorId: string, key: string): number {
  let hash = (seed ^ (round * 0x9e3779b9)) >>> 0;
  for (const character of `${actorId}|${key}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash / 0x100000000;
}

function actionKey(action: AiAction): string {
  if (action.kind === "end") return "hold";
  if (action.kind === "move") return `move:${positionKey(action.position)}`;
  if (action.target.kind === "unit") return `${action.abilityId}:unit:${action.target.unitId}`;
  if (action.target.kind === "cell") return `${action.abilityId}:cell:${positionKey(action.target.position)}`;
  if (action.target.kind === "objective") return `${action.abilityId}:objective:${action.target.objectiveId}`;
  return `${action.abilityId}:self`;
}
