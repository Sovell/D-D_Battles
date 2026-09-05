import type { HeroClassDefinition } from "../domain/types";
import { meleeAttack, rangedAttack } from "./abilities";

export const heroClasses: HeroClassDefinition[] = [
  {
    id: "fighter", name: "Fighter", speed: 5, maxCharges: 2, abilityScores: { strength: 16, dexterity: 13, constitution: 16, intelligence: 10, wisdom: 12, charisma: 10 }, weaponProficiencies: ["simple", "martial"],
    baseAttackProgression: "good", hitDie: 10, tacticalBaseHp: 21, saveProgressions: { fortitude: "good", reflex: "poor", will: "poor" }, initiativeBonus: 1, armorProficiencies: ["light", "medium", "heavy"], shieldProficiency: true,
    basicAttack: meleeAttack("longsword", "Longsword", { count: 1, sides: 8, bonus: 4 }),
    abilities: [
      { ...meleeAttack("shield-bash", "Shield Bash", { count: 1, sides: 6, bonus: 4 }, "bludgeoning"), source: "weapon-technique", resourceCost: 1, status: "prone", description: "Atak tarczą i przewrócenie celu.", tags: ["melee", "requires-shield"] },
      { ...meleeAttack("cleave", "Cleave", { count: 1, sides: 8, bonus: 3 }), source: "weapon-technique", resourceCost: 1, area: 1, description: "Uderza cel i sąsiadującego wroga.", tags: ["melee"] },
      { id: "guard", name: "Guard", description: "+2 Obrony do następnej aktywacji.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "guarded" },
    ],
    passive: { id: "armored-vanguard", name: "Armored Vanguard", description: "+1 Obrony, gdy sąsiaduje z żywym sojusznikiem." },
  },
  {
    id: "rogue", name: "Rogue", speed: 6, maxCharges: 3, abilityScores: { strength: 10, dexterity: 17, constitution: 13, intelligence: 14, wisdom: 12, charisma: 12 }, weaponProficiencies: ["simple", "shortsword", "shortbow"],
    baseAttackProgression: "average", hitDie: 6, tacticalBaseHp: 17, saveProgressions: { fortitude: "poor", reflex: "good", will: "poor" }, initiativeBonus: 3, armorProficiencies: ["light"], shieldProficiency: false, weaponFinesse: true,
    basicAttack: meleeAttack("shortsword", "Shortsword", { count: 1, sides: 6, bonus: 3 }, "piercing"),
    abilities: [
      { ...meleeAttack("sneak-attack", "Sneak Attack", { count: 3, sides: 6 }), source: "weapon-technique", resourceCost: 1, description: "Atak aktualną lekką bronią z dodatkowymi kośćmi za pozycję.", tags: ["melee"] },
      { id: "evasive-step", name: "Evasive Step", description: "Przemieść się bez reakcji.", range: 4, resourceCost: 1, target: "cell", kind: "move" },
      { ...rangedAttack("throw-dagger", "Throw Dagger", 5, { count: 1, sides: 4, bonus: 3 }, "piercing"), source: "weapon-technique", resourceCost: 1, tags: ["ranged", "requires-dagger"] },
    ],
    passive: { id: "cunning-position", name: "Cunning Position", description: "Sneak Attack wymaga flankowania celu z sojusznikiem." },
  },
  {
    id: "cleric", name: "Cleric", speed: 5, maxCharges: 3, abilityScores: { strength: 14, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 17, charisma: 13 }, weaponProficiencies: ["simple"],
    baseAttackProgression: "average", hitDie: 8, tacticalBaseHp: 18, saveProgressions: { fortitude: "good", reflex: "poor", will: "good" }, initiativeBonus: 1, armorProficiencies: ["light", "medium", "heavy"], shieldProficiency: true, castingAbility: "wisdom",
    basicAttack: meleeAttack("mace", "Mace", { count: 1, sides: 8, bonus: 2 }, "bludgeoning"),
    abilities: [
      { id: "healing-word", name: "Healing Word", description: "Leczy 1d8+5 HP.", range: 5, resourceCost: 1, target: "ally", kind: "heal", damage: { count: 1, sides: 8, bonus: 5 } },
      { id: "turn-undead", name: "Turn Undead", description: "Nieumarli testują Will lub są Frightened.", range: 4, resourceCost: 1, target: "enemy", kind: "status", save: "will", saveDc: { rank: 1, ability: "charisma" }, status: "frightened", area: 4 },
      { id: "bless", name: "Bless", description: "+1 do ataku dla sojusznika.", range: 5, resourceCost: 1, target: "ally", kind: "status", status: "blessed" },
    ],
    passive: { id: "beacon-of-faith", name: "Beacon of Faith", description: "Leczenie poniżej połowy HP otrzymuje +2." },
  },
  {
    id: "wizard", name: "Wizard", speed: 5, maxCharges: 3, abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 17, wisdom: 13, charisma: 10 }, weaponProficiencies: ["dagger", "quarterstaff", "light-crossbow"],
    baseAttackProgression: "poor", hitDie: 4, tacticalBaseHp: 15, saveProgressions: { fortitude: "poor", reflex: "poor", will: "good" }, initiativeBonus: 1, armorProficiencies: [], shieldProficiency: false, castingAbility: "intelligence",
    basicAttack: rangedAttack("fire-bolt", "Fire Bolt", 6, { count: 1, sides: 6, bonus: 1 }, "fire"),
    abilities: [
      { id: "magic-missile", name: "Magic Missile", description: "Pewne obrażenia siłowe.", range: 7, resourceCost: 1, target: "enemy", kind: "damage", damage: { count: 2, sides: 4, bonus: 2 }, damageType: "force" },
      { id: "burning-hands", name: "Burning Hands", description: "Obszar ognia o promieniu 1; Reflex ST 13 zmniejsza obrażenia.", range: 2, resourceCost: 1, target: "cell", kind: "damage", damage: { count: 2, sides: 6 }, damageType: "fire", save: "reflex", saveDc: { rank: 1 }, area: 1, status: "burning" },
      { id: "web", name: "Web", description: "Obszar o promieniu 1; Reflex ST 13 albo Webbed.", range: 6, resourceCost: 1, target: "cell", kind: "status", save: "reflex", saveDc: { rank: 2 }, status: "webbed", area: 1 },
    ],
    passive: { id: "arcane-recovery", name: "Arcane Recovery", description: "Odzyskuje 1 ładunek po pierwszym krytyku." },
  },
  {
    id: "barbarian", name: "Barbarian", speed: 6, maxCharges: 4, abilityScores: { strength: 17, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 12, charisma: 10 }, weaponProficiencies: ["simple", "martial"], role: "frontliner", equipmentTags: ["two-handed", "medium-armor", "healing"], powerWeights: { offense: 5, protection: 2, control: 2, mobility: 3, support: 0 },
    baseAttackProgression: "good", hitDie: 12, tacticalBaseHp: 23, saveProgressions: { fortitude: "good", reflex: "poor", will: "poor" }, initiativeBonus: 1, armorProficiencies: ["light", "medium"], shieldProficiency: true, unarmoredDefense: "constitution",
    basicAttack: meleeAttack("barbarian-greataxe", "Greataxe", { count: 1, sides: 12, bonus: 4 }),
    abilities: [
      { id: "rage", name: "Rage", description: "3 rundy: +2 ataku, +3 obrażeń i odporność na kontrolę, ale -2 Obrony; potem zadyszka.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "raging", statusDuration: 3, cooldown: 4, special: "rage", tags: ["stance", "offense"] },
      { ...meleeAttack("reckless-charge", "Reckless Charge", { count: 2, sides: 6, bonus: 4 }), description: "Szarża do celu na 3 pola; mocny cios, ale Barbarian staje się Exposed.", range: 3, resourceCost: 1, special: "reckless-charge", tags: ["melee", "mobility"] },
      { id: "intimidating-roar", name: "Intimidating Roar", description: "Wrogowie w promieniu 2 zostają Weakened.", range: 0, area: 2, resourceCost: 1, target: "self", kind: "status", status: "weakened", statusDuration: 2, cooldown: 3, special: "intimidating-roar", tags: ["control"] },
      { id: "bloodied-resolve", name: "Bloodied Resolve", description: "Przy połowie HP redukuje otrzymywane obrażenia o 2 przez 2 rundy.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "protected", statusDuration: 2, cooldown: 4, special: "bloodied-resolve", tags: ["protection"] },
      { id: "whirlwind", name: "Whirlwind", description: "Atak 2k6+3 przeciw wszystkim sąsiednim wrogom.", range: 0, area: 1, resourceCost: 2, target: "cell", kind: "damage", damage: { count: 2, sides: 6, bonus: 3 }, damageType: "slashing", cooldown: 4, special: "whirlwind", tags: ["melee", "area", "offense"] },
    ], passive: { id: "relentless", name: "Relentless", description: "Najgroźniejszy w zwarciu, lecz gorzej chroniony niż Fighter." },
  },
  {
    id: "bard", name: "Bard", speed: 6, maxCharges: 5, abilityScores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 17 }, weaponProficiencies: ["simple", "longsword", "shortsword"], role: "support", equipmentTags: ["light-armor", "utility", "instrument"], powerWeights: { offense: 2, protection: 1, control: 3, mobility: 3, support: 5 },
    baseAttackProgression: "average", hitDie: 6, tacticalBaseHp: 18, saveProgressions: { fortitude: "poor", reflex: "good", will: "good" }, initiativeBonus: 3, armorProficiencies: ["light"], shieldProficiency: true, castingAbility: "charisma",
    basicAttack: rangedAttack("bard-crossbow", "Light Crossbow", 5, { count: 1, sides: 6, bonus: 2 }, "piercing"), abilities: [
      { id: "inspire-courage", name: "Inspire Courage", description: "Sojusznicy w promieniu 3 otrzymują Inspired na 3 rundy.", range: 0, area: 3, resourceCost: 1, target: "self", kind: "status", status: "inspired", statusDuration: 3, cooldown: 3, special: "inspire-courage", tags: ["support", "aura"] },
      { id: "dissonant-note", name: "Dissonant Note", description: "Wróg staje się Exposed na 2 rundy.", range: 6, resourceCost: 1, target: "enemy", kind: "status", status: "exposed", statusDuration: 2, save: "will", saveDc: { rank: 1 }, special: "dissonant-note", tags: ["control", "spell"] },
      { id: "inspiring-step", name: "Inspiring Step", description: "Sojusznik otrzymuje +2 ruchu na 2 rundy.", range: 5, resourceCost: 1, target: "ally", kind: "status", status: "swift", statusDuration: 2, special: "inspiring-step", tags: ["support", "mobility"] },
      { id: "song-restoration", name: "Song of Restoration", description: "Leczy sojuszników w promieniu 2 o 1k6+3 i usuwa jeden negatywny status.", range: 0, area: 2, resourceCost: 2, target: "self", kind: "heal", damage: { count: 1, sides: 6, bonus: 3 }, cooldown: 5, special: "song-restoration", tags: ["support", "healing"] },
      { id: "crescendo", name: "Crescendo", description: "Sojusznicy w promieniu 3 otrzymują Inspired i Swift na jedną rundę.", range: 0, area: 3, resourceCost: 2, target: "self", kind: "status", status: "inspired", statusDuration: 2, cooldown: 6, special: "crescendo", tags: ["support", "aura"] },
    ], passive: { id: "battle-rhythm", name: "Battle Rhythm", description: "Wzmacnia kolejne tury drużyny, lecz nie zastępuje głównego uzdrowiciela." },
  },
  {
    id: "druid", name: "Druid", speed: 5, maxCharges: 5, abilityScores: { strength: 12, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 17, charisma: 10 }, weaponProficiencies: ["dagger", "quarterstaff"], role: "controller", equipmentTags: ["natural", "light-armor", "healing"], powerWeights: { offense: 2, protection: 2, control: 5, mobility: 3, support: 3 },
    baseAttackProgression: "average", hitDie: 8, tacticalBaseHp: 17, saveProgressions: { fortitude: "good", reflex: "poor", will: "good" }, initiativeBonus: 0, armorProficiencies: ["light", "medium"], shieldProficiency: true, castingAbility: "wisdom", forbidsMetalArmor: true,
    basicAttack: meleeAttack("druid-staff", "Oak Staff", { count: 1, sides: 6, bonus: 2 }, "bludgeoning"), abilities: [
      { id: "entangle", name: "Entangle", description: "Tworzy trudny teren w promieniu 1 i może unieruchomić wrogów.", range: 6, area: 1, resourceCost: 1, target: "cell", kind: "status", status: "webbed", statusDuration: 2, save: "reflex", saveDc: { rank: 1 }, cooldown: 3, special: "entangle", tags: ["spell", "control", "terrain"] },
      { id: "healing-touch", name: "Healing Touch", description: "Leczy pobliskiego sojusznika o 1k8+3.", range: 2, resourceCost: 1, target: "ally", kind: "heal", damage: { count: 1, sides: 8, bonus: 3 }, tags: ["spell", "healing"] },
      { ...rangedAttack("thorn-lash", "Thorn Lash", 4, { count: 1, sides: 6, bonus: 2 }, "piercing"), resourceCost: 1, description: "Rani i przyciąga cel o jedno pole.", special: "thorn-lash", tags: ["spell", "control"] },
      { id: "wild-shape", name: "Wild Shape", description: "3 rundy: +2 ataku i ruchu; bez czarów i przedmiotów.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "wild-shaped", statusDuration: 3, cooldown: 5, special: "wild-shape", tags: ["stance", "mobility"] },
      { id: "call-of-the-wild", name: "Call of the Wild", description: "Przyzywa kontrolowanego wilka na 3 rundy.", range: 0, resourceCost: 2, target: "self", kind: "status", cooldown: 6, special: "call-wild", tags: ["summon", "support"] },
    ], passive: { id: "nature-shaper", name: "Nature Shaper", description: "Zmienia teren lub czasowo przejmuje rolę walczącego w zwarciu." },
  },
  {
    id: "monk", name: "Monk", speed: 8, maxCharges: 5, abilityScores: { strength: 12, dexterity: 17, constitution: 14, intelligence: 10, wisdom: 16, charisma: 8 }, weaponProficiencies: ["dagger", "light-crossbow", "quarterstaff"], role: "skirmisher", equipmentTags: ["boots", "unarmored", "utility"], powerWeights: { offense: 3, protection: 2, control: 4, mobility: 5, support: 0 },
    baseAttackProgression: "average", hitDie: 8, tacticalBaseHp: 16, saveProgressions: { fortitude: "good", reflex: "good", will: "good" }, initiativeBonus: 3, armorProficiencies: [], shieldProficiency: false, unarmoredDefense: "wisdom", weaponFinesse: true,
    basicAttack: meleeAttack("unarmed-strike", "Unarmed Strike", { count: 1, sides: 6, bonus: 3 }, "bludgeoning"), abilities: [
      { ...meleeAttack("flurry-of-blows", "Flurry of Blows", { count: 3, sides: 4, bonus: 1 }, "bludgeoning"), resourceCost: 1, description: "Trzy lekkie ciosy, skuteczne przeciw niskiej Obronie.", special: "flurry", tags: ["melee", "offense"] },
      { ...meleeAttack("stunning-strike", "Stunning Strike", { count: 1, sides: 6, bonus: 2 }, "bludgeoning"), resourceCost: 1, status: "stunned", save: "fortitude", saveDc: { rank: 1, ability: "wisdom" }, description: "Cios ogłusza cel na jedną rundę.", statusDuration: 1, cooldown: 3, special: "stunning-strike", tags: ["melee", "control"] },
      { id: "step-of-the-wind", name: "Step of the Wind", description: "Skok do 5 pól, ignorujący strefy przeciwników.", range: 5, resourceCost: 1, target: "cell", kind: "move", cooldown: 2, special: "step-wind", tags: ["mobility"] },
      { id: "deflect-projectiles", name: "Deflect Projectiles", description: "Redukuje pierwszy atak dystansowy każdej rundy o 6.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "deflecting", statusDuration: 3, cooldown: 5, special: "deflect-projectiles", tags: ["reaction", "protection"] },
      { ...meleeAttack("quivering-palm", "Quivering Palm", { count: 4, sides: 6, bonus: 3 }, "force"), resourceCost: 2, description: "Potężny cios; boss zamiast ogłuszenia otrzymuje Weakened.", status: "stunned", statusDuration: 2, cooldown: 6, special: "quivering-palm", tags: ["melee", "offense", "control"] },
    ], passive: { id: "mobile-interruptor", name: "Mobile Interruptor", description: "Dociera do odizolowanych celów i przerywa ich plan." },
  },
  {
    id: "paladin", name: "Paladin", speed: 5, maxCharges: 4, abilityScores: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 }, weaponProficiencies: ["simple", "martial"], role: "defender", equipmentTags: ["heavy-armor", "shield", "divine"], powerWeights: { offense: 2, protection: 5, control: 2, mobility: 1, support: 4 },
    baseAttackProgression: "good", hitDie: 10, tacticalBaseHp: 19, saveProgressions: { fortitude: "good", reflex: "poor", will: "poor" }, initiativeBonus: 1, armorProficiencies: ["light", "medium", "heavy"], shieldProficiency: true, castingAbility: "wisdom",
    basicAttack: meleeAttack("paladin-longsword", "Longsword", { count: 1, sides: 8, bonus: 3 }), abilities: [
      { id: "lay-on-hands", name: "Lay on Hands", description: "Leczy 1k8+5; może podnieść sojusznika z 0 HP.", range: 1, resourceCost: 1, target: "ally", kind: "heal", damage: { count: 1, sides: 8, bonus: 5 }, cooldown: 2, special: "lay-hands", tags: ["healing", "divine"] },
      { id: "divine-challenge", name: "Divine Challenge", description: "Oznaczony wróg ma -2 do ataku przeciw innym celom.", range: 5, resourceCost: 1, target: "enemy", kind: "status", status: "challenged", statusDuration: 3, cooldown: 3, special: "divine-challenge", tags: ["control", "divine"] },
      { ...meleeAttack("smite-evil", "Smite Evil", { count: 2, sides: 6, bonus: 2 }, "radiant"), resourceCost: 1, description: "Dodatkowe 1k8 obrażeń przeciw undead, evil, elite i boss.", cooldown: 2, special: "smite-evil", tags: ["melee", "divine", "offense"] },
      { id: "aura-of-protection", name: "Aura of Protection", description: "Sąsiedni sojusznicy otrzymują Protected na 3 rundy.", range: 0, area: 1, resourceCost: 1, target: "self", kind: "status", status: "protected", statusDuration: 3, cooldown: 5, special: "aura-protection", tags: ["aura", "protection", "divine"] },
      { id: "paladin-turn-undead", name: "Turn Undead", description: "Osłabia i odpycha undead; żywych wrogów tylko oznacza światłem.", range: 0, area: 4, resourceCost: 2, target: "self", kind: "status", cooldown: 5, special: "paladin-turn-undead", tags: ["area", "control", "divine"] },
    ], passive: { id: "holy-guardian", name: "Holy Guardian", description: "Chroni wybranego sojusznika i specjalizuje się w walce z mrokiem." },
  },
  {
    id: "ranger", name: "Ranger", speed: 7, maxCharges: 5, abilityScores: { strength: 12, dexterity: 17, constitution: 14, intelligence: 10, wisdom: 15, charisma: 8 }, weaponProficiencies: ["simple", "martial"], role: "ranged", equipmentTags: ["ranged", "light-armor", "utility"], powerWeights: { offense: 4, protection: 1, control: 3, mobility: 4, support: 2 },
    baseAttackProgression: "good", hitDie: 8, tacticalBaseHp: 18, saveProgressions: { fortitude: "good", reflex: "good", will: "poor" }, initiativeBonus: 3, armorProficiencies: ["light", "medium"], shieldProficiency: true, castingAbility: "wisdom",
    basicAttack: rangedAttack("ranger-longbow", "Longbow", 7, { count: 1, sides: 8, bonus: 3 }, "piercing"), abilities: [
      { id: "hunters-mark", name: "Hunter's Mark", description: "Oznacza cel: sojusznicy otrzymują +1 do ataku przeciw niemu.", range: 8, resourceCost: 1, target: "enemy", kind: "status", status: "hunted", statusDuration: 4, special: "hunters-mark", tags: ["support", "ranged"] },
      { ...rangedAttack("aimed-shot", "Aimed Shot", 10, { count: 2, sides: 8, bonus: 3 }, "piercing"), resourceCost: 1, description: "Daleki strzał dostępny tylko przed ruchem.", cooldown: 2, special: "aimed-shot", tags: ["ranged", "offense"] },
      { id: "set-snare", name: "Set Snare", description: "Umieszcza pułapkę: 4 obrażenia i Webbed po wejściu wroga.", range: 3, resourceCost: 1, target: "cell", kind: "status", cooldown: 3, special: "set-snare", tags: ["terrain", "control"] },
      { ...rangedAttack("evasive-retreat", "Evasive Retreat", 6, { count: 1, sides: 8, bonus: 2 }, "piercing"), resourceCost: 1, description: "Atak i przygotowanie bezpiecznego odskoku (+2 ruchu).", cooldown: 3, special: "evasive-retreat", tags: ["ranged", "mobility"] },
      { id: "volley", name: "Volley", description: "Salwa 2k6 na obszarze 1; nie rani sojuszników.", range: 8, area: 1, resourceCost: 2, target: "cell", kind: "damage", damage: { count: 2, sides: 6 }, damageType: "piercing", cooldown: 5, special: "volley", tags: ["ranged", "area", "offense"] },
    ], passive: { id: "prepared-hunter", name: "Prepared Hunter", description: "Oznacza priorytetowy cel i przygotowuje bezpieczne strefy." },
  },
  {
    id: "sorcerer", name: "Sorcerer", speed: 5, maxCharges: 6, abilityScores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 17 }, weaponProficiencies: ["simple"], resourceName: "Arcane Surge", role: "striker", equipmentTags: ["arcane", "weapon", "damage"], powerWeights: { offense: 5, protection: 0, control: 1, mobility: 1, support: 0 },
    baseAttackProgression: "poor", hitDie: 4, tacticalBaseHp: 14, saveProgressions: { fortitude: "poor", reflex: "poor", will: "good" }, initiativeBonus: 2, armorProficiencies: [], shieldProficiency: false, castingAbility: "charisma",
    basicAttack: rangedAttack("sorcerer-ray", "Arcane Ray", 6, { count: 1, sides: 6, bonus: 1 }, "force"), abilities: [
      { id: "arcane-bolt", name: "Arcane Bolt", description: "Niezawodny atak 2k4+2; krótki cooldown.", range: 7, resourceCost: 0, target: "enemy", kind: "damage", damage: { count: 2, sides: 4, bonus: 2 }, damageType: "force", cooldown: 1, special: "arcane-bolt", tags: ["spell", "offense"] },
      { id: "sorcerer-burning-hands", name: "Burning Hands", description: "Ryzykowny obszar ognia na krótkim dystansie; bez friendly fire.", range: 2, area: 1, resourceCost: 1, target: "cell", kind: "damage", damage: { count: 2, sides: 6, bonus: 1 }, damageType: "fire", status: "burning", save: "reflex", saveDc: { rank: 1 }, cooldown: 2, special: "sorcerer-burning-hands", tags: ["spell", "area", "offense"] },
      { id: "spell-surge", name: "Spell Surge", description: "Następne zaklęcie zadaje +3 obrażenia, kosztem Arcane Surge.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "surging", statusDuration: 3, cooldown: 2, special: "spell-surge", tags: ["spell", "stance"] },
      { id: "chromatic-burst", name: "Chromatic Burst", description: "Wybuch 2k6 energii; spowalnia trafione cele.", range: 6, area: 1, resourceCost: 1, target: "cell", kind: "damage", damage: { count: 2, sides: 6 }, damageType: "cold", status: "prone", save: "reflex", saveDc: { rank: 2 }, cooldown: 3, special: "chromatic-burst", tags: ["spell", "area", "offense"] },
      { id: "fireball", name: "Fireball", description: "Duży wybuch 4k6 w promieniu 2; bez friendly fire, długi cooldown.", range: 8, area: 2, resourceCost: 2, target: "cell", kind: "damage", damage: { count: 4, sides: 6 }, damageType: "fire", save: "reflex", saveDc: { rank: 3 }, cooldown: 6, special: "fireball", tags: ["spell", "area", "offense"] },
    ], passive: { id: "arcane-surge-resource", name: "Arcane Surge", description: "Odzyskuje 1 ładunek po pokonaniu wroga." },
  },
];

export const heroClassById = new Map(heroClasses.map((hero) => [hero.id, hero]));
