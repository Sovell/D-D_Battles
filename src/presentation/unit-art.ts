import fighterSheet from "../assets/units/fighter.png";
import rogueSheet from "../assets/units/rogue.png";
import clericSheet from "../assets/units/cleric.png";
import wizardSheet from "../assets/units/wizard.png";
import ghoulSheet from "../assets/units/ghoul.png";
import goblinSheet from "../assets/units/goblin.png";
import skeletonSheet from "../assets/units/skeleton.png";
import owlbearSheet from "../assets/units/owlbear.png";
import ogreSheet from "../assets/units/ogre.png";
import ritualistSheet from "../assets/units/ritualist.png";
import spiderSheet from "../assets/units/giant-spider.png";
import bugbearAmbusherSheet from "../assets/units/bugbear-ambusher.png";
import direWolfSheet from "../assets/units/dire-wolf.png";
import harpySheet from "../assets/units/harpy.png";
import hobgoblinCaptainSheet from "../assets/units/hobgoblin-captain.png";
import manticoreSheet from "../assets/units/manticore.png";
import minotaurSheet from "../assets/units/minotaur.png";
import orcBruteSheet from "../assets/units/orc-brute.png";
import trollSheet from "../assets/units/troll.png";
import worgSheet from "../assets/units/worg.png";
import wraithSheet from "../assets/units/wraith.png";
import youngDragonSheet from "../assets/units/young-dragon.png";
import zombieSheet from "../assets/units/zombie.png";
import dwarfRoguePortrait from "../assets/units/heroes/dwarf-rogue.png";
import dwarfWizardPortrait from "../assets/units/heroes/dwarf-wizard.png";
import elfClericPortrait from "../assets/units/heroes/elf-cleric.png";
import elfFighterPortrait from "../assets/units/heroes/elf-fighter.png";
import halflingClericPortrait from "../assets/units/heroes/halfling-cleric.png";
import halflingFighterPortrait from "../assets/units/heroes/halfling-fighter.png";
import halflingWizardPortrait from "../assets/units/heroes/halfling-wizard.png";

export interface ArtFrame { x: number; y: number; width: number; height: number }
export interface UnitArtFrame extends ArtFrame { url: string; sheetWidth: number; sheetHeight: number }
interface UnitArtSheet {
  url: string;
  sheetWidth: number;
  sheetHeight: number;
  variants: number;
  portrait(variant: number): ArtFrame;
  token(variant: number): ArtFrame;
}

const heroSheet = (url: string, sheetWidth: number, sheetHeight: number, portraitInsetY = 0): UnitArtSheet => {
  const columnWidth = sheetWidth / 3;
  const rowHeight = sheetHeight / 2;
  return {
    url, sheetWidth, sheetHeight, variants: 3,
    portrait: (variant) => ({ x: variant * columnWidth, y: portraitInsetY, width: columnWidth, height: rowHeight - portraitInsetY }),
    token: (variant) => ({ x: variant * columnWidth, y: rowHeight, width: columnWidth, height: rowHeight }),
  };
};

const monsterSheet = (url: string, sheetWidth: number, sheetHeight: number, portraitInsetY: number): UnitArtSheet => {
  const columnWidth = sheetWidth / 2;
  return {
    url, sheetWidth, sheetHeight, variants: 1,
    portrait: () => ({ x: 0, y: portraitInsetY, width: columnWidth, height: sheetHeight - portraitInsetY }),
    token: () => ({ x: columnWidth, y: 0, width: columnWidth, height: sheetHeight }),
  };
};

const sheets: Record<string, UnitArtSheet> = {
  fighter: heroSheet(fighterSheet, 1024, 1536, 30),
  rogue: heroSheet(rogueSheet, 1536, 1024),
  cleric: heroSheet(clericSheet, 1536, 1024),
  wizard: heroSheet(wizardSheet, 1536, 1024),
  ghoul: monsterSheet(ghoulSheet, 1536, 1024, 55),
  goblin: monsterSheet(goblinSheet, 1402, 1122, 80),
  skeleton: monsterSheet(skeletonSheet, 1402, 1122, 55),
  owlbear: monsterSheet(owlbearSheet, 1536, 1024, 55),
  ogre: monsterSheet(ogreSheet, 1536, 1024, 45),
  ritualist: monsterSheet(ritualistSheet, 1536, 1024, 35),
  "giant-spider": monsterSheet(spiderSheet, 1536, 1024, 90),
  "bugbear-ambusher": monsterSheet(bugbearAmbusherSheet, 1536, 1024, 0),
  "dire-wolf": monsterSheet(direWolfSheet, 1536, 1024, 0),
  harpy: monsterSheet(harpySheet, 1536, 1024, 0),
  "hobgoblin-captain": monsterSheet(hobgoblinCaptainSheet, 1548, 1016, 0),
  manticore: monsterSheet(manticoreSheet, 1536, 1024, 0),
  minotaur: monsterSheet(minotaurSheet, 1536, 1024, 0),
  "orc-brute": monsterSheet(orcBruteSheet, 1254, 1254, 0),
  troll: monsterSheet(trollSheet, 1536, 1024, 0),
  worg: monsterSheet(worgSheet, 1708, 921, 0),
  wraith: monsterSheet(wraithSheet, 1536, 1024, 0),
  "young-dragon": monsterSheet(youngDragonSheet, 1536, 1024, 0),
  zombie: monsterSheet(zombieSheet, 1536, 1024, 0),
};

const extraHeroPortraits: Record<string, string[]> = {
  fighter: [elfFighterPortrait, halflingFighterPortrait],
  rogue: [dwarfRoguePortrait],
  cleric: [elfClericPortrait, halflingClericPortrait],
  wizard: [dwarfWizardPortrait, halflingWizardPortrait],
};

export function getUnitArt(definitionId: string, variant = 0, kind: "portrait" | "token" = "portrait"): UnitArtFrame | undefined {
  const sheet = sheets[definitionId];
  if (!sheet) return undefined;
  const normalizedInput = Math.max(0, Math.floor(variant));
  const extraPortrait = kind === "portrait" ? extraHeroPortraits[definitionId]?.[normalizedInput - sheet.variants] : undefined;
  if (extraPortrait) return { url: extraPortrait, sheetWidth: 1254, sheetHeight: 1254, x: 0, y: 0, width: 1254, height: 1254 };
  const normalizedVariant = kind === "token" && normalizedInput >= sheet.variants ? 0 : Math.min(sheet.variants - 1, normalizedInput);
  return { url: sheet.url, sheetWidth: sheet.sheetWidth, sheetHeight: sheet.sheetHeight, ...sheet[kind](normalizedVariant) };
}

export function getUnitArtVariantCount(definitionId: string): number {
  return (sheets[definitionId]?.variants ?? 0) + (extraHeroPortraits[definitionId]?.length ?? 0);
}

export function getUnitTokenCardArt(definitionId: string, variant = 0, targetAspect = 0.9): UnitArtFrame | undefined {
  const art = getUnitArt(definitionId, variant, "token");
  if (!art) return undefined;
  const currentAspect = art.width / art.height;
  if (currentAspect < targetAspect) {
    const height = art.width / targetAspect;
    return { ...art, y: art.y, height };
  }
  const width = art.height * targetAspect;
  return { ...art, x: art.x + (art.width - width) / 2, width };
}
