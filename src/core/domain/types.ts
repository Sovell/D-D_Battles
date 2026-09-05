export type Id = string;
export type Side = "heroes" | "monsters";
export type SaveKind = "fortitude" | "reflex" | "will";
export type DamageType = "slashing" | "piercing" | "bludgeoning" | "fire" | "acid" | "cold" | "poison" | "force" | "radiant";
export type StatusId = "poisoned" | "burning" | "frightened" | "prone" | "stunned" | "webbed" | "regenerating" | "guarded" | "blessed" | "raging" | "fatigued" | "exposed" | "weakened" | "inspired" | "swift" | "wild-shaped" | "deflecting" | "hunted" | "challenged" | "protected" | "surging" | "quivering" | "summoned";
export type TerrainType = "wall" | "floor" | "difficult" | "rubble" | "water" | "highGround" | "hazard" | "cover";
export type Doctrine = "skirmisher" | "brute" | "ranged" | "controller" | "guardian" | "boss";
export type RaceId = "human" | "dwarf" | "elf" | "halfling" | "half-elf" | "half-orc";

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
  cooldown?: number;
  statusDuration?: number;
  tags?: string[];
  /** Final attack modifier for attacks whose accuracy comes from the wielded weapon. */
  attackBonusOverride?: number;
  saveDcOverride?: number;
  saveDc?: { rank: 0 | 1 | 2 | 3; ability?: AbilityScoreId };
  source?: "weapon-attack" | "weapon-technique" | "spell-attack" | "spell-save" | "automatic";
  extraDamage?: { damage: Dice; damageType: DamageType };
  special?: "rage" | "reckless-charge" | "intimidating-roar" | "bloodied-resolve" | "whirlwind" | "inspire-courage" | "dissonant-note" | "inspiring-step" | "song-restoration" | "crescendo" | "entangle" | "thorn-lash" | "wild-shape" | "call-wild" | "flurry" | "stunning-strike" | "step-wind" | "deflect-projectiles" | "quivering-palm" | "lay-hands" | "divine-challenge" | "smite-evil" | "aura-protection" | "paladin-turn-undead" | "hunters-mark" | "aimed-shot" | "set-snare" | "evasive-retreat" | "volley" | "arcane-bolt" | "sorcerer-burning-hands" | "spell-surge" | "chromatic-burst" | "fireball" | "switch-weapon";
}

export interface AbilityScores { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number }
export type AbilityScoreId = keyof AbilityScores;

export interface HeroClassDefinition {
  id: Id;
  name: string;
  speed: number;
  basicAttack: AbilityDefinition;
  abilities: AbilityDefinition[];
  passive: { id: Id; name: string; description: string };
  maxCharges: number;
  role?: "frontliner" | "support" | "controller" | "skirmisher" | "defender" | "ranged" | "striker";
  powerWeights?: { offense: number; protection: number; control: number; mobility: number; support: number };
  equipmentTags?: string[];
  resourceName?: string;
  abilityScores: AbilityScores;
  /** Weapon categories (simple/martial) or explicit item ids the class is proficient with. */
  weaponProficiencies: string[];
  baseAttackProgression: "good" | "average" | "poor";
  hitDie: 4 | 6 | 8 | 10 | 12;
  tacticalBaseHp: number;
  saveProgressions: Record<SaveKind, "good" | "poor">;
  initiativeBonus: number;
  armorProficiencies: Array<"light" | "medium" | "heavy">;
  shieldProficiency: boolean;
  castingAbility?: AbilityScoreId;
  unarmoredDefense?: "wisdom" | "constitution";
  forbidsMetalArmor?: boolean;
  weaponFinesse?: boolean;
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
  abilityScoreIncreases?: Partial<Record<AbilityScoreId, number>>;
}

export interface ExpeditionHistoryEntry {
  id: Id;
  scenarioId: Id;
  scenarioName: string;
  completedAt: string;
  outcome: "victory" | "defeat";
  participantIds: Id[];
  difficulty: DifficultyLabel;
  difficultyRatio: number;
  reward?: RewardBundle;
}

export interface PartyProfile {
  id: Id;
  name: string;
  memberIds: Id[];
  stash: ItemStack[];
  gold: number;
  materials: number;
  expeditionHistory: ExpeditionHistoryEntry[];
  createdAt: string;
}

export type ItemRarity = "common" | "uncommon" | "rare" | "epic";
export type EquipmentSlot = "weapon" | "armor" | "shield" | "cloak" | "boots" | "belt" | "trinket" | "ring" | "consumable";
export interface WeaponProfile { category: "simple" | "martial"; handedness: "light" | "one-handed" | "two-handed"; attackKind: "melee" | "ranged" | "thrown"; damage: Dice; damageType: DamageType; range: number; finesseEligible?: boolean; enhancementBonus?: number; energyDamage?: { damage: Dice; damageType: DamageType } }
export interface ArmorProfile { category: "light" | "medium" | "heavy"; armorBonus: number; maxDexBonus: number | null; speedPenalty: number; material: "metal" | "nonmetal" }
export type ItemEffect =
  | { type: "stat"; stat: "defense" | "attack" | "speed"; value: number; stackingGroup?: string }
  | { type: "save"; save: SaveKind | "all"; value: number }
  | { type: "healing"; amount: number; charges: number; range?: number }
  | { type: "damage"; amount: number; damageType: DamageType; charges: number; range: number; status?: StatusId; area?: number }
  | { type: "status"; status: StatusId; charges: number }
  | { type: "utility"; utility: "locks" | "traps" | "light" | "stealth" | "teleport" | "smoke" | "block-cell" | "recover-ability" | "ignore-difficult" | "anti-poison"; value?: number; charges?: number };
export interface ItemDefinition { id: Id; name: string; description: string; rarity: ItemRarity; slot: EquipmentSlot; levelMin: number; stackLimit: number; effects: ItemEffect[]; tags: string[]; weaponAttack?: AbilityDefinition; weapon?: WeaponProfile; armor?: ArmorProfile; shieldBonus?: number; rewardEligible?: boolean }
export interface DerivedCombatStats { abilityScores: AbilityScores; abilityModifiers: AbilityScores; bab: number; maxHp: number; defenseClass: number; acBreakdown: { base: number; dexterity: number; armor: number; shield: number; naturalArmor: number; deflection: number; other: number }; saves: Saves; saveBreakdown: Record<SaveKind, { base: number; ability: number; equipment: number }>; initiative: number; speed: number; attackBonus: number; basicAttack: AbilityDefinition; maxCharges: number }
export interface ItemStack { definitionId: Id; quantity: number }
export interface HeroLoadout { weapon: Id | null; backupWeapon?: Id | null; armor: Id | null; shield: Id | null; cloak: Id | null; boots: Id | null; belt: Id | null; trinket: Id | null; ring?: Id | null; consumables: Array<Id | null> }
export type DifficultyLabel = "Trivial" | "Easy" | "Standard" | "Hard" | "Deadly" | "Overwhelming";
export interface RewardBundle { id: Id; scenarioId: Id; partyId?: Id; choices: Id[]; level: number; bossCache: boolean; difficulty: DifficultyLabel; xp: number; gold: number; materials: number }
export interface CampaignState {
  version: 1;
  heroes: HeroProfile[];
  parties: PartyProfile[];
  selectedPartyId: Id;
  /** @deprecated Compatibility view of the selected party stash. */
  inventory: ItemStack[];
  /** @deprecated Compatibility view of the selected party members. */
  activePartyIds: Id[];
  loadouts: Record<Id, HeroLoadout>;
  starterKitsGranted?: boolean;
  pendingReward?: RewardBundle;
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
  threatRating?: number;
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
  persistentRewards?: boolean;
  encounterThemeId?: EncounterThemeId;
  objectiveModifier?: number;
  defenderAdvantage?: number;
  rewardBundle?: RewardBundle;
  difficultyRatio?: number;
  partyPower?: number;
  encounterPower?: number;
}

export type EncounterThemeId = "goblin-raid" | "undead-crypt" | "beast-hunt" | "orc-warband" | "fiendish-ritual" | "dragons-lair";
export interface EncounterTheme {
  id: EncounterThemeId;
  name: string;
  allowedMonsterIds: Id[];
  preferredRoles: Doctrine[];
  biomes: Array<DungeonMap["theme"]>;
  objectiveTypes: ScenarioTemplateId[];
  rewardTable: { preferredTags: string[]; uniqueItemId?: Id };
  bossId?: Id;
}

export type ScenarioMapMode = "fixed" | "regenerate";
export interface SavedScenario {
  schemaVersion: 1;
  id: Id;
  name: string;
  description: string;
  localAuthor: string;
  createdAt: string;
  presetId: ScenarioTemplateId;
  encounterThemeId: EncounterThemeId;
  aiSettings: { enabled: boolean; doctrine: "adaptive" | "fixed" };
  encounterBudget: number;
  monsterIds: Id[];
  monsterPositions?: GridPosition[];
  persistentRewards: boolean;
  mapMode: ScenarioMapMode;
  baseSeed: number;
  mapEnvironment: "dungeon" | "outdoor" | "interior";
  map: DungeonMap;
  events: ScenarioEventDefinition[];
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
  abilityScores?: AbilityScores;
  derivedStats?: DerivedCombatStats;
  basicAttack: AbilityDefinition;
  abilities: AbilityDefinition[];
  charges: number;
  maxCharges: number;
  cooldowns?: Record<Id, number>;
  statuses: ActiveStatus[];
  doctrine?: Doctrine;
  resistances: DamageType[];
  tags: string[];
  artVariant?: number;
  moved: boolean;
  acted: boolean;
  activatedRound?: number;
  reactionUsedRound?: number;
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
  heroLoadoutSnapshots?: Record<Id, HeroLoadout>;
  spentItemCharges?: Record<Id, Record<Id, number>>;
  traps?: Array<{ id: Id; position: GridPosition; sourceId: Id; damage: number; remainingRounds: number }>;
}

export interface CampaignSave {
  schemaVersion: 1;
  party: Array<{ heroClassId: Id; level: number }>;
  equipment: Id[];
  unlocks: Id[];
  lastExpeditionSeed?: number;
}
