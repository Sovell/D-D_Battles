export type Id = string;
export type Side = "heroes" | "monsters";
export type SaveKind = "fortitude" | "reflex" | "will";
export type DamageType = "slashing" | "piercing" | "bludgeoning" | "fire" | "poison" | "force" | "radiant";
export type StatusId = "poisoned" | "burning" | "frightened" | "prone" | "stunned" | "webbed" | "regenerating" | "guarded" | "blessed";
export type TerrainType = "wall" | "floor" | "difficult" | "rubble" | "water" | "highGround" | "hazard" | "cover";
export type Doctrine = "skirmisher" | "brute" | "ranged" | "controller" | "guardian" | "boss";

export interface GridPosition { x: number; y: number }
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
  resistances?: DamageType[];
  tags?: string[];
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
export interface ScenarioDefinition {
  id: Id;
  name: string;
  description: string;
  objectiveText: string;
  theme: DungeonMap["theme"];
  encounter: EncounterDefinition;
  victoryCondition: "destroy-foci-and-undead" | "defeat-ritualist" | "escape-with-artifact";
  roundLimit?: number;
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
  statuses: ActiveStatus[];
  doctrine?: Doctrine;
  resistances: DamageType[];
  tags: string[];
  moved: boolean;
  acted: boolean;
}

export interface BattleLogEntry { id: number; text: string; kind: "system" | "roll" | "damage" | "status" }
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
}

export interface CampaignSave {
  schemaVersion: 1;
  party: Array<{ heroClassId: Id; level: number }>;
  equipment: Id[];
  unlocks: Id[];
  lastExpeditionSeed?: number;
}
