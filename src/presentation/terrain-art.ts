import cryptStoneFloorUrl from "../assets/terrain/crypt-stone-floor.png";
import lavaHazardUrl from "../assets/terrain/lava-hazard.png";
import mossyBoulderUrl from "../assets/terrain/mossy-boulder.png";
import rockyRubbleUrl from "../assets/terrain/rocky-rubble.png";
import ruinedStoneWallUrl from "../assets/terrain/ruined-stone-wall.png";
import ruinsDirtFloorUrl from "../assets/terrain/ruins-dirt-floor.png";
import type { DungeonMap, TerrainType } from "../core/domain/types";

export interface TerrainArt {
  url: string;
  alpha?: number;
  frame?: { x: number; y: number; width: number; height: number };
}

const ruinedWallCenter = { x: 443, y: 0, width: 887, height: 887 };
const ruinedWallEdge = { x: 0, y: 0, width: 887, height: 887 };
const boulderCenter = { x: 256, y: 0, width: 1024, height: 1024 };

const terrainArt: Record<DungeonMap["theme"], Partial<Record<TerrainType, TerrainArt>>> = {
  crypt: {
    floor: { url: cryptStoneFloorUrl },
    rubble: { url: rockyRubbleUrl },
    cover: { url: ruinedStoneWallUrl, frame: ruinedWallEdge },
    wall: { url: ruinedStoneWallUrl, frame: ruinedWallCenter, alpha: 0.9 },
  },
  ruins: {
    floor: { url: ruinsDirtFloorUrl },
    rubble: { url: rockyRubbleUrl },
    highGround: { url: mossyBoulderUrl, frame: boulderCenter },
    hazard: { url: lavaHazardUrl },
    wall: { url: ruinedStoneWallUrl, frame: ruinedWallCenter, alpha: 0.9 },
  },
  cave: {},
};

export function getTerrainArt(theme: DungeonMap["theme"], terrain: TerrainType): TerrainArt | undefined {
  return terrainArt[theme][terrain];
}
