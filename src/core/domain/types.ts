export type Id = string;
export type Side = "heroes" | "monsters";
export type SaveKind = "fortitude" | "reflex" | "will";
export type DamageType = "slashing" | "piercing" | "bludgeoning" | "fire" | "poison" | "force" | "radiant";
export type StatusId = "poisoned" | "burning" | "frightened" | "prone" | "stunned" | "webbed" | "regenerating" | "guarded" | "blessed";
export type TerrainType = "wall" | "floor" | "difficult" | "rubble" | "water" | "highGround" | "hazard" | "cover";
export type Doctrine = "skirmisher" | "brute" | "ranged" | "controller" | "guardian" | "boss";
export type RaceId = "human" | "dwarf" | "elf" | "halfling";

export interface GridPosition { x: number; y: number }
export type ActionTarget =
  | { kind: "self" }
  | { kind: "unit"; unitId: Id }
  | { kind: "cell"; position: GridPosition }
  | { kind: "objective"; objectiveId: Id };
export interface Dice { count: number; sides: number; bonus?: number }
export interface Saves { fortitude: number; reflex: number; will: number }

export interface AbilityDefinition {
  id: Id;
  name: string;
  description: string;
  range: number;
  resourceCost: number;
  target: "self" | "ally" | "enemy" | "cell";
  kind: "attack" | "damage" | "heal" | "status" | "move";
  damage?: Dice;
  damageType?: DamageType;
  save?: SaveKind;
  status?: StatusId;
  area?: number;
}

export interface HeroClassDefinition {
  id: Id;
  name: string;
  maxHp: number;
  defenseClass: number;
  saves: Saves;
  speed: number;
  initiative: number;
  attackBonus: number;
  basicAttack: AbilityDefinition;
  abilities: AbilityDefinition[];
  passive: { id: Id; name: string; description: string };
  maxCharges: number;
}

export interface HeroProfile {
  id: Id;
  name: string;
  race: RaceId;
  classId: Id;
  level: number;
  xp: number;
  selectedAbilityIds: Id[];
  portraitVariant: number;
}

export interface MonsterDefinition {
  id: Id;
  name: string;
  maxHp: number;
  defenseClass: number;
  saves: Saves;
  speed: number;
  initiative: number;
  attackBonus: number;
  basicAttack: AbilityDefinition;
  abilities: AbilityDefinition[];
  traits: string[];
  doctrine: Doctrine;
  tier: 1 | 2 | 3 | 4 | 5;
  tacticalCounter: string;
  resistances?: DamageType[];
  tags?: string[];
}

export type ScenarioCondition =
  | { type: "all-monsters-defeated" }
  | { type: "survive-until-round"; round: number }
  | { type: "unit-defeated"; definitionId: Id }
  | { type: "objectives-destroyed" }
  | { type: "round-exceeded"; round: number }
  | { type: "side-in-zone"; side: Side; center: GridPosition; radius: number; required: number | "all" }
  | { type: "all"; conditions: ScenarioCondition[] }
  | { type: "any"; conditions: ScenarioCondition[] };

export type ScenarioTemplateId = "skirmish" | "hold-the-line" | "breakthrough" | "assassinate" | "rescue" | "ritual-disruption" | "escape" | "treasure-run";
export interface ScenarioTemplateDefinition {
  id: ScenarioTemplateId;
  name: string;
  description: string;
  objectiveText: string;
  failureText: string;
  suggestedLevel: { min: number; max: number };
  rewardXp: number;
  roundLimit?: number;
  environment: "dungeon" | "outdoor" | "interior";
  theme: DungeonMap["theme"];
  monsters: Id[];
  requiresObjectives: boolean;
  events: ScenarioEventDefinition[];
}

export interface StatusEffectDefinition {
  id: StatusId;
  name: string;
  description: string;
}

export interface LootDefinition { id: Id; name: string; description: string; rarity: "common" | "uncommon" | "rare" }
export interface MapCell { position: GridPosition; terrain: TerrainType; objectiveId?: Id }
export interface DungeonRoom { id: Id; x: number; y: number; width: number; height: number }
export interface DungeonMap {
  id: Id;
  seed: number;
  theme: "crypt" | "cave" | "ruins";
  width: number;
  height: number;
  cells: MapCell[];
  rooms: DungeonRoom[];
  heroStart: GridPosition[];
  monsterStart: GridPosition[];
  objectives: Array<{ id: Id; position: GridPosition; hp: number }>;
}

export interface EncounterDefinition { id: Id; name: string; monsters: Id[]; seedOffset: number }
export type ScenarioEventTrigger =
  | { type: "battle-start" }
  | { type: "round-start"; round: number }
  | { type: "unit-defeated"; side?: Side; definitionId?: Id }
  | { type: "objective-destroyed"; objectiveId?: Id }
  | { type: "unit-entered-cell"; position: GridPosition; side?: Side; definitionId?: Id };
export type ScenarioEventEffect =
  | { type: "show-message"; text: string }
  | { type: "change-objective"; text: string }
  | { type: "spawn-monsters"; monsterIds: Id[] }
  | { type: "victory"; text: string }
  | { type: "defeat"; text: string };
export interface ScenarioEventDefinition {
  id: Id;
  name: string;
  trigger: ScenarioEventTrigger;
  effect: ScenarioEventEffect;
  visibility?: "announced" | "hidden";
}
export interface ScenarioDefinition {
  id: Id;
  name: string;
  description: string;
  objectiveText: string;
  theme: DungeonMap["theme"];
  encounter: EncounterDefinition;
  victoryCondition: "destroy-foci-and-undead" | "defeat-ritualist" | "escape-with-artifact" | "template-rules";
  victoryRules?: ScenarioCondition;
  defeatRules?: ScenarioCondition;
  failureText?: string;
  objectiveLabel?: string;
  templateId?: ScenarioTemplateId;
  roundLimit?: number;
  events?: ScenarioEventDefinition[];
  map?: DungeonMap;
  rewardXp?: number;
}

export interface ActiveStatus { id: StatusId; remainingRounds: number; sourceId?: Id }
export interface Combatant {
  id: Id;
  definitionId: Id;
  name: string;
  side: Side;
  position: GridPosition;
  hp: number;
  maxHp: number;
  defenseClass: number;
  saves: Saves;
  speed: number;
  initiativeBonus: number;
  initiative: number;
  attackBonus: number;
  basicAttack: AbilityDefinition;
  abilities: AbilityDefinition[];
  charges: number;
  cooldowns?: Record<Id, number>;
  statuses: ActiveStatus[];
  doctrine?: Doctrine;
  resistances: DamageType[];
  tags: string[];
  artVariant?: number;
  moved: boolean;
  acted: boolean;
  activatedRound?: number;
}

export interface BattleLogEntry { id: number; text: string; kind: "system" | "roll" | "damage" | "status" }
export interface ScenarioEventNotice { id: Id; name: string; text: string }
export interface BattleState {
  seed: number;
  randomState: number;
  scenario: ScenarioDefinition;
  map: DungeonMap;
  combatants: Combatant[];
  initiativeOrder: Id[];
  activeIndex: number;
  round: number;
  objectives: Array<{ id: Id; position: GridPosition; hp: number; maxHp: number }>;
  outcome: "active" | "victory" | "defeat";
  log: BattleLogEntry[];
  resolvedEventIds?: Id[];
  pendingEventNotices?: ScenarioEventNotice[];
  objectiveTextOverride?: string;
  heroSnapshots?: HeroProfile[];
  progressionRewardClaimed?: boolean;
}

export interface CampaignSave {
  schemaVersion: 1;
  party: Array<{ heroClassId: Id; level: number }>;
  equipment: Id[];
  unlocks: Id[];
  lastExpeditionSeed?: number;
}
