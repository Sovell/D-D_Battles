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

const heroSheet = (url: string, sheetWidth: number, sheetHeight: number): UnitArtSheet => {
  const columnWidth = sheetWidth / 3;
  const rowHeight = sheetHeight / 2;
  return {
    url, sheetWidth, sheetHeight, variants: 3,
    portrait: (variant) => ({ x: variant * columnWidth, y: 0, width: columnWidth, height: rowHeight }),
    token: (variant) => ({ x: variant * columnWidth, y: rowHeight, width: columnWidth, height: rowHeight }),
  };
};

const monsterSheet = (url: string, sheetWidth: number, sheetHeight: number): UnitArtSheet => {
  const columnWidth = sheetWidth / 2;
  return {
    url, sheetWidth, sheetHeight, variants: 1,
    portrait: () => ({ x: 0, y: 0, width: columnWidth, height: sheetHeight }),
    token: () => ({ x: columnWidth, y: 0, width: columnWidth, height: sheetHeight }),
  };
};

const sheets: Record<string, UnitArtSheet> = {
  fighter: heroSheet(fighterSheet, 1024, 1536),
  rogue: heroSheet(rogueSheet, 1536, 1024),
  cleric: heroSheet(clericSheet, 1536, 1024),
  wizard: heroSheet(wizardSheet, 1536, 1024),
  ghoul: monsterSheet(ghoulSheet, 1536, 1024),
  goblin: monsterSheet(goblinSheet, 1402, 1122),
  skeleton: monsterSheet(skeletonSheet, 1402, 1122),
  owlbear: monsterSheet(owlbearSheet, 1536, 1024),
  ogre: monsterSheet(ogreSheet, 1536, 1024),
  ritualist: monsterSheet(ritualistSheet, 1536, 1024),
  "giant-spider": monsterSheet(spiderSheet, 1536, 1024),
};

export function getUnitArt(definitionId: string, variant = 0, kind: "portrait" | "token" = "portrait"): UnitArtFrame | undefined {
  const sheet = sheets[definitionId];
  if (!sheet) return undefined;
  const normalizedVariant = Math.max(0, Math.min(sheet.variants - 1, Math.floor(variant)));
  return { url: sheet.url, sheetWidth: sheet.sheetWidth, sheetHeight: sheet.sheetHeight, ...sheet[kind](normalizedVariant) };
}

export function getUnitArtVariantCount(definitionId: string): number {
  return sheets[definitionId]?.variants ?? 0;
}

export function getUnitArtBackground(definitionId: string, variant = 0, kind: "portrait" | "token" = "portrait") {
  const art = getUnitArt(definitionId, variant, kind);
  if (!art) return undefined;
  const positionX = art.sheetWidth === art.width ? 0 : art.x / (art.sheetWidth - art.width) * 100;
  const positionY = art.sheetHeight === art.height ? 0 : art.y / (art.sheetHeight - art.height) * 100;
  return {
    backgroundImage: `url("${art.url}")`,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundSize: `${art.sheetWidth / art.width * 100}% auto`,
  };
}
