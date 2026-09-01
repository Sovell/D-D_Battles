import type { HeroClassDefinition } from "../domain/types";
import { meleeAttack, rangedAttack } from "./abilities";

export const heroClasses: HeroClassDefinition[] = [
  {
    id: "fighter", name: "Fighter", maxHp: 34, defenseClass: 17, saves: { fortitude: 6, reflex: 2, will: 2 }, speed: 5, initiative: 2, attackBonus: 7, maxCharges: 2,
    basicAttack: meleeAttack("longsword", "Longsword", { count: 1, sides: 8, bonus: 4 }),
    abilities: [
      { ...meleeAttack("shield-bash", "Shield Bash", { count: 1, sides: 6, bonus: 4 }, "bludgeoning"), resourceCost: 1, status: "prone", description: "Atak i przewrócenie celu." },
      { ...meleeAttack("cleave", "Cleave", { count: 1, sides: 8, bonus: 3 }), resourceCost: 1, area: 1, description: "Uderza cel i sąsiadującego wroga." },
      { id: "guard", name: "Guard", description: "+2 Obrony do następnej aktywacji.", range: 0, resourceCost: 1, target: "self", kind: "status", status: "guarded" },
    ],
    passive: { id: "armored-vanguard", name: "Armored Vanguard", description: "+1 Obrony, gdy sąsiaduje z żywym sojusznikiem." },
  },
  {
    id: "rogue", name: "Rogue", maxHp: 24, defenseClass: 15, saves: { fortitude: 2, reflex: 7, will: 2 }, speed: 6, initiative: 6, attackBonus: 6, maxCharges: 3,
    basicAttack: meleeAttack("shortsword", "Shortsword", { count: 1, sides: 6, bonus: 3 }, "piercing"),
    abilities: [
      { ...meleeAttack("sneak-attack", "Sneak Attack", { count: 3, sides: 6 }), resourceCost: 1, description: "Silny cios wykorzystujący pozycję." },
      { id: "evasive-step", name: "Evasive Step", description: "Przemieść się bez reakcji.", range: 4, resourceCost: 1, target: "cell", kind: "move" },
      { ...rangedAttack("throw-dagger", "Throw Dagger", 5, { count: 1, sides: 4, bonus: 3 }, "piercing"), resourceCost: 1 },
    ],
    passive: { id: "cunning-position", name: "Cunning Position", description: "Sneak Attack wymaga flankowania celu z sojusznikiem." },
  },
  {
    id: "cleric", name: "Cleric", maxHp: 28, defenseClass: 16, saves: { fortitude: 5, reflex: 2, will: 7 }, speed: 5, initiative: 1, attackBonus: 5, maxCharges: 3,
    basicAttack: meleeAttack("mace", "Mace", { count: 1, sides: 8, bonus: 2 }, "bludgeoning"),
    abilities: [
      { id: "healing-word", name: "Healing Word", description: "Leczy 1d8+5 HP.", range: 5, resourceCost: 1, target: "ally", kind: "heal", damage: { count: 1, sides: 8, bonus: 5 } },
      { id: "turn-undead", name: "Turn Undead", description: "Nieumarli testują Will lub są Frightened.", range: 4, resourceCost: 1, target: "enemy", kind: "status", save: "will", status: "frightened", area: 4 },
      { id: "bless", name: "Bless", description: "+1 do ataku dla sojusznika.", range: 5, resourceCost: 1, target: "ally", kind: "status", status: "blessed" },
    ],
    passive: { id: "beacon-of-faith", name: "Beacon of Faith", description: "Leczenie poniżej połowy HP otrzymuje +2." },
  },
  {
    id: "wizard", name: "Wizard", maxHp: 20, defenseClass: 13, saves: { fortitude: 2, reflex: 3, will: 7 }, speed: 5, initiative: 3, attackBonus: 5, maxCharges: 3,
    basicAttack: rangedAttack("fire-bolt", "Fire Bolt", 6, { count: 1, sides: 6, bonus: 1 }, "fire"),
    abilities: [
      { id: "magic-missile", name: "Magic Missile", description: "Pewne obrażenia siłowe.", range: 7, resourceCost: 1, target: "enemy", kind: "damage", damage: { count: 2, sides: 4, bonus: 2 }, damageType: "force" },
      { id: "burning-hands", name: "Burning Hands", description: "Obszar ognia o promieniu 1; Reflex ST 13 zmniejsza obrażenia.", range: 2, resourceCost: 1, target: "cell", kind: "damage", damage: { count: 2, sides: 6 }, damageType: "fire", save: "reflex", area: 1, status: "burning" },
      { id: "web", name: "Web", description: "Obszar o promieniu 1; Reflex ST 13 albo Webbed.", range: 6, resourceCost: 1, target: "cell", kind: "status", save: "reflex", status: "webbed", area: 1 },
    ],
    passive: { id: "arcane-recovery", name: "Arcane Recovery", description: "Odzyskuje 1 ładunek po pierwszym krytyku." },
  },
];

export const heroClassById = new Map(heroClasses.map((hero) => [hero.id, hero]));
