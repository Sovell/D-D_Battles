import { monsterById } from "../data/monsters";
import type { BattleState, Combatant, GridPosition, ScenarioEventDefinition, ScenarioEventTrigger, Side } from "../domain/types";
import { createRandom } from "../random/random";
import { positionKey } from "../rules/pathfinding";

export type ScenarioEventSignal =
  | { type: "battle-start" }
  | { type: "round-start"; round: number }
  | { type: "unit-defeated"; unitId: string; side: Side; definitionId: string }
  | { type: "objective-destroyed"; objectiveId: string }
  | { type: "unit-entered-cell"; unitId: string; side: Side; definitionId: string; position: GridPosition };

export function resolveScenarioEvents(state: BattleState, signals: readonly ScenarioEventSignal[]): BattleState {
  if (signals.length === 0) return state;
  const resolved = new Set(state.resolvedEventIds ?? []);
  let next = state;
  for (const event of state.scenario.events ?? []) {
    if (resolved.has(event.id) || !signals.some((signal) => triggerMatches(event.trigger, signal))) continue;
    next = applyEvent(next, event);
    resolved.add(event.id);
  }
  return { ...next, resolvedEventIds: [...resolved] };
}

export function resolveStateChangeEvents(before: BattleState, after: BattleState, extraSignals: readonly ScenarioEventSignal[] = []): BattleState {
  const signals: ScenarioEventSignal[] = [...extraSignals];
  for (const unit of after.combatants) {
    const previous = before.combatants.find((candidate) => candidate.id === unit.id);
    if (previous && previous.hp > 0 && unit.hp <= 0) signals.push({ type: "unit-defeated", unitId: unit.id, side: unit.side, definitionId: unit.definitionId });
  }
  for (const objective of after.objectives) {
    const previous = before.objectives.find((candidate) => candidate.id === objective.id);
    if (previous && previous.hp > 0 && objective.hp <= 0) signals.push({ type: "objective-destroyed", objectiveId: objective.id });
  }
  return resolveScenarioEvents(after, signals);
}

export function dismissScenarioEventNotice(state: BattleState): BattleState {
  return { ...state, pendingEventNotices: (state.pendingEventNotices ?? []).slice(1) };
}

export function validateScenarioEvents(events: readonly ScenarioEventDefinition[]): boolean {
  const ids = events.map((event) => event.id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return false;
  return events.every((event) => event.name.trim().length > 0 && validateTrigger(event.trigger) && validateEffect(event.effect));
}

function triggerMatches(trigger: ScenarioEventTrigger, signal: ScenarioEventSignal): boolean {
  if (trigger.type !== signal.type) return false;
  if (trigger.type === "battle-start") return true;
  if (trigger.type === "round-start") return signal.type === "round-start" && trigger.round === signal.round;
  if (trigger.type === "unit-defeated") return signal.type === "unit-defeated" && matchesUnit(trigger, signal);
  if (trigger.type === "objective-destroyed") return signal.type === "objective-destroyed" && (!trigger.objectiveId || trigger.objectiveId === signal.objectiveId);
  return signal.type === "unit-entered-cell"
    && positionKey(trigger.position) === positionKey(signal.position)
    && matchesUnit(trigger, signal);
}

function matchesUnit(filter: { side?: Side; definitionId?: string }, unit: { side: Side; definitionId: string }): boolean {
  return (!filter.side || filter.side === unit.side) && (!filter.definitionId || filter.definitionId === unit.definitionId);
}

function applyEvent(state: BattleState, event: ScenarioEventDefinition): BattleState {
  const effect = event.effect;
  let next = state;
  let text: string;
  if (effect.type === "spawn-monsters") {
    const result = spawnMonsters(next, event.id, effect.monsterIds);
    next = result.state;
    text = result.spawned > 0 ? `${event.name}: ${result.spawned} ${result.spawned === 1 ? "przeciwnik dołącza" : "przeciwników dołącza"} do bitwy.` : `${event.name}: na mapie nie ma miejsca na posiłki.`;
  } else if (effect.type === "change-objective") {
    next = { ...next, objectiveTextOverride: effect.text };
    text = effect.text;
  } else {
    text = effect.text;
    if (effect.type === "victory") next = { ...next, outcome: "victory" };
    if (effect.type === "defeat") next = { ...next, outcome: "defeat" };
  }
  const logId = (next.log.at(-1)?.id ?? 0) + 1;
  return {
    ...next,
    log: [...next.log.slice(-59), { id: logId, text: `Wydarzenie — ${event.name}: ${text}`, kind: "system" }],
    pendingEventNotices: [...(next.pendingEventNotices ?? []), { id: event.id, name: event.name, text }],
  };
}

function spawnMonsters(state: BattleState, eventId: string, monsterIds: string[]): { state: BattleState; spawned: number } {
  const definitions = monsterIds.flatMap((id) => {
    const definition = monsterById.get(id);
    return definition ? [definition] : [];
  });
  if (definitions.length === 0) return { state, spawned: 0 };
  const occupied = new Set([
    ...state.combatants.filter((unit) => unit.hp > 0).map((unit) => positionKey(unit.position)),
    ...state.objectives.filter((objective) => objective.hp > 0).map((objective) => positionKey(objective.position)),
  ]);
  const entry = state.map.monsterStart.at(0) ?? { x: state.map.width - 1, y: 0 };
  const cells = state.map.cells
    .filter((cell) => cell.terrain !== "wall" && !occupied.has(positionKey(cell.position)))
    .sort((left, right) => distance(left.position, entry) - distance(right.position, entry) || left.position.y - right.position.y || left.position.x - right.position.x);
  const random = createRandom(state.randomState);
  const added: Combatant[] = [];
  for (const [index, definition] of definitions.entries()) {
    const cell = cells.shift();
    if (!cell) break;
    const id = uniqueId(state, added, `event-${eventId}-${definition.id}-${index + 1}`);
    added.push({
      id, definitionId: definition.id, name: definition.name, side: "monsters", position: cell.position,
      hp: definition.maxHp, maxHp: definition.maxHp, defenseClass: definition.defenseClass, saves: definition.saves,
      speed: definition.speed, initiativeBonus: definition.initiative, initiative: random.int(1, 20) + definition.initiative,
      attackBonus: definition.attackBonus, basicAttack: definition.basicAttack, abilities: definition.abilities, charges: 0,
      cooldowns: {}, statuses: [], doctrine: definition.doctrine, resistances: definition.resistances ?? [], tags: definition.tags ?? [],
      artVariant: 0, moved: false, acted: false,
    });
  }
  return {
    state: {
      ...state,
      randomState: random.state,
      combatants: [...state.combatants, ...added],
      initiativeOrder: [...state.initiativeOrder, ...added.map((unit) => unit.id)],
    },
    spawned: added.length,
  };
}

function uniqueId(state: BattleState, added: Combatant[], base: string): string {
  const ids = new Set([...state.combatants, ...added].map((unit) => unit.id));
  let id = base;
  let suffix = 2;
  while (ids.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function validateTrigger(trigger: ScenarioEventTrigger): boolean {
  if (trigger.type === "round-start") return Number.isInteger(trigger.round) && trigger.round >= 1;
  if (trigger.type === "unit-entered-cell") return Number.isInteger(trigger.position.x) && Number.isInteger(trigger.position.y) && trigger.position.x >= 0 && trigger.position.y >= 0;
  return true;
}

function validateEffect(effect: ScenarioEventDefinition["effect"]): boolean {
  if (effect.type === "spawn-monsters") return effect.monsterIds.length > 0 && effect.monsterIds.every((id) => monsterById.has(id));
  return effect.text.trim().length > 0;
}

function distance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
