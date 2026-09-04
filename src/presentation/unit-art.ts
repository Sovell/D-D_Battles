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
import halfelfBarbarianPortrait from "../assets/units/heroes/classes/halfelf-barbarian-portrait.png";
import halfelfBarbarianToken from "../assets/units/heroes/classes/halfelf-barbarian-token.png";
import halforcBarbarianPortrait from "../assets/units/heroes/classes/halforc-barbarian-portrait.png";
import halforcBarbarianToken from "../assets/units/heroes/classes/halforc-barbarian-token.png";
import elfBardPortrait from "../assets/units/heroes/classes/elf-bard-portrait.png";
import elfBardToken from "../assets/units/heroes/classes/elf-bard-token.png";
import humanBardPortrait from "../assets/units/heroes/classes/human-bard-portrait.png";
import humanBardToken from "../assets/units/heroes/classes/human-bard-token.png";
import elfDruidFemalePortrait from "../assets/units/heroes/classes/elf-druid-female-portrait.png";
import elfDruidFemaleToken from "../assets/units/heroes/classes/elf-druid-female-token.png";
import elfDruidPortrait from "../assets/units/heroes/classes/elf-druid-portrait.png";
import elfDruidToken from "../assets/units/heroes/classes/elf-druid-token.png";
import halfelfMonkPortrait from "../assets/units/heroes/classes/halfelf-monk-portrait.png";
import halfelfMonkToken from "../assets/units/heroes/classes/halfelf-monk-token.png";
import halflingMonkPortrait from "../assets/units/heroes/classes/halfling-monk-portrait.png";
import halflingMonkToken from "../assets/units/heroes/classes/halfling-monk-token.png";
import dwarfPaladinPortrait from "../assets/units/heroes/classes/dwarf-paladin-portrait.png";
import dwarfPaladinToken from "../assets/units/heroes/classes/dwarf-paladin-token.png";
import humanPaladinFemalePortrait from "../assets/units/heroes/classes/human-paladin-female-portrait.png";
import humanPaladinFemaleToken from "../assets/units/heroes/classes/human-paladin-female-token.png";
import elfRangerFemalePortrait from "../assets/units/heroes/classes/elf-ranger-female-portrait.png";
import elfRangerFemaleToken from "../assets/units/heroes/classes/elf-ranger-female-token.png";
import elfRangerPortrait from "../assets/units/heroes/classes/elf-ranger-portrait.png";
import elfRangerToken from "../assets/units/heroes/classes/elf-ranger-token.png";
import elfSorcererPortrait from "../assets/units/heroes/classes/elf-sorcerer-portrait.png";
import elfSorcererToken from "../assets/units/heroes/classes/elf-sorcerer-token.png";
import humanSorcererPortrait from "../assets/units/heroes/classes/human-sorcerer-portrait.png";
import humanSorcererToken from "../assets/units/heroes/classes/human-sorcerer-token.png";

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

interface IndividualHeroArt { portrait: UnitArtFrame; token: UnitArtFrame }

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

const individualFrame = (url: string, width: number, height: number): UnitArtFrame => ({ url, sheetWidth: width, sheetHeight: height, x: 0, y: 0, width, height });
const individualHeroArt: Record<string, IndividualHeroArt[]> = {
  barbarian: [
    { portrait: individualFrame(halfelfBarbarianPortrait, 1024, 1536), token: individualFrame(halfelfBarbarianToken, 1024, 1536) },
    { portrait: individualFrame(halforcBarbarianPortrait, 1024, 1536), token: individualFrame(halforcBarbarianToken, 1024, 1536) },
  ],
  bard: [
    { portrait: individualFrame(elfBardPortrait, 1254, 1254), token: individualFrame(elfBardToken, 1024, 1536) },
    { portrait: individualFrame(humanBardPortrait, 1122, 1402), token: individualFrame(humanBardToken, 1024, 1536) },
  ],
  druid: [
    { portrait: individualFrame(elfDruidFemalePortrait, 1197, 1315), token: individualFrame(elfDruidFemaleToken, 1024, 1536) },
    { portrait: individualFrame(elfDruidPortrait, 1024, 1536), token: individualFrame(elfDruidToken, 1024, 1536) },
  ],
  monk: [
    { portrait: individualFrame(halfelfMonkPortrait, 1024, 1536), token: individualFrame(halfelfMonkToken, 1024, 1536) },
    { portrait: individualFrame(halflingMonkPortrait, 1023, 1537), token: individualFrame(halflingMonkToken, 1024, 1536) },
  ],
  paladin: [
    { portrait: individualFrame(dwarfPaladinPortrait, 1023, 1537), token: individualFrame(dwarfPaladinToken, 1024, 1536) },
    { portrait: individualFrame(humanPaladinFemalePortrait, 1024, 1536), token: individualFrame(humanPaladinFemaleToken, 1024, 1536) },
  ],
  ranger: [
    { portrait: individualFrame(elfRangerFemalePortrait, 1122, 1402), token: individualFrame(elfRangerFemaleToken, 1024, 1536) },
    { portrait: individualFrame(elfRangerPortrait, 1023, 1537), token: individualFrame(elfRangerToken, 1024, 1536) },
  ],
  sorcerer: [
    { portrait: individualFrame(elfSorcererPortrait, 1024, 1536), token: individualFrame(elfSorcererToken, 1024, 1536) },
    { portrait: individualFrame(humanSorcererPortrait, 1254, 1254), token: individualFrame(humanSorcererToken, 1024, 1536) },
  ],
};

export function getUnitArt(definitionId: string, variant = 0, kind: "portrait" | "token" = "portrait"): UnitArtFrame | undefined {
  const individual = individualHeroArt[definitionId];
  if (individual?.length) return individual[Math.min(individual.length - 1, Math.max(0, Math.floor(variant)))][kind];
  const sheet = sheets[definitionId];
  if (!sheet) return undefined;
  const normalizedInput = Math.max(0, Math.floor(variant));
  const extraPortrait = kind === "portrait" ? extraHeroPortraits[definitionId]?.[normalizedInput - sheet.variants] : undefined;
  if (extraPortrait) return { url: extraPortrait, sheetWidth: 1254, sheetHeight: 1254, x: 0, y: 0, width: 1254, height: 1254 };
  const normalizedVariant = kind === "token" && normalizedInput >= sheet.variants ? 0 : Math.min(sheet.variants - 1, normalizedInput);
  return { url: sheet.url, sheetWidth: sheet.sheetWidth, sheetHeight: sheet.sheetHeight, ...sheet[kind](normalizedVariant) };
}

export function getUnitArtVariantCount(definitionId: string): number {
  return individualHeroArt[definitionId]?.length ?? ((sheets[definitionId]?.variants ?? 0) + (extraHeroPortraits[definitionId]?.length ?? 0));
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
