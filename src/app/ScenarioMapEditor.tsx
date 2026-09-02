import { useState } from "react";
import type { GridPosition, TerrainType } from "../core/domain/types";
import type { MapEnvironment } from "../core/map-generation/scenario-map";
import { editScenarioMapCell, regenerateScenarioMap, type ScenarioDraft, type ScenarioMapTool } from "./scenario-builder-model";

const environments: Array<{ id: MapEnvironment; name: string; description: string }> = [
  { id: "dungeon", name: "Lochy", description: "Pomieszczenia i wąskie korytarze" },
  { id: "outdoor", name: "Teren otwarty", description: "Więcej przestrzeni i naturalnych przeszkód" },
  { id: "interior", name: "Wnętrze", description: "Sale, ściany działowe i przejścia" },
];
const tools: Array<{ id: ScenarioMapTool; name: string; glyph: string }> = [
  { id: "floor", name: "Podłoga", glyph: "·" }, { id: "wall", name: "Mur", glyph: "■" },
  { id: "rubble", name: "Gruz", glyph: "▧" }, { id: "cover", name: "Osłona", glyph: "▤" },
  { id: "highGround", name: "Wzniesienie", glyph: "▲" }, { id: "hazard", name: "Zagrożenie", glyph: "✦" },
  { id: "hero-start", name: "Start bohaterów", glyph: "H" }, { id: "monster-start", name: "Strefa potworów", glyph: "M" },
  { id: "objective", name: "Cel", glyph: "◆" },
];

export function ScenarioMapEditor({ draft, onChange }: { draft: ScenarioDraft; onChange(draft: ScenarioDraft): void }) {
  const [tool, setTool] = useState<ScenarioMapTool>("floor");
  const heroKeys = new Map(draft.map.heroStart.map((position, index) => [key(position), index + 1]));
  const monsterKeys = new Set(draft.map.monsterStart.map(key));
  const objectiveKeys = new Set(draft.map.objectives.map((objective) => key(objective.position)));
  const paint = (position: GridPosition) => onChange(editScenarioMapCell(draft, position, tool));
  return <>
    <div className="environment-picker">{environments.map((environment) => <button aria-pressed={draft.mapEnvironment === environment.id} className={draft.mapEnvironment === environment.id ? "selected" : ""} key={environment.id} onClick={() => onChange(regenerateScenarioMap(draft, environment.id))} type="button"><strong>{environment.name}</strong><small>{environment.description}</small></button>)}</div>
    <div className="map-workshop">
      <div className="map-tools"><div><strong>Narzędzia MG</strong><small>Wybierz narzędzie i kliknij pole</small></div>{tools.map((item) => <button aria-pressed={tool === item.id} className={`${tool === item.id ? "selected" : ""} tool-${item.id}`} key={item.id} onClick={() => setTool(item.id)} type="button"><b>{item.glyph}</b><span>{item.name}</span></button>)}<button className="regenerate-map" onClick={() => onChange(regenerateScenarioMap(draft))} type="button">Wygeneruj ponownie</button></div>
      <div className="map-editor-wrap">
        <div aria-label="Edytor mapy scenariusza" className="map-editor-grid" role="grid" style={{ gridTemplateColumns: `repeat(${draft.map.width}, 1fr)` }}>
          {draft.map.cells.map((cell) => {
            const cellKey = key(cell.position);
            const marker = heroKeys.has(cellKey) ? `H${heroKeys.get(cellKey)}` : monsterKeys.has(cellKey) ? "M" : objectiveKeys.has(cellKey) ? "◆" : "";
            return <button aria-label={`Pole ${cell.position.x},${cell.position.y}: ${terrainName(cell.terrain)}${marker ? `, znacznik ${marker}` : ""}`} className={`map-editor-cell terrain-${cell.terrain} ${marker ? "has-marker" : ""}`} key={cellKey} onClick={() => paint(cell.position)} type="button"><span>{marker}</span></button>;
          })}
        </div>
        <div className="map-editor-summary"><span><b>{draft.map.width}×{draft.map.height}</b> pól</span><span><b>{draft.map.heroStart.length}</b> starty bohaterów</span><span><b>{draft.map.monsterStart.length}</b> strefy potworów</span><span><b>{draft.map.objectives.length}</b> cele</span></div>
      </div>
    </div>
  </>;
}

function terrainName(terrain: TerrainType): string {
  return ({ floor: "podłoga", wall: "mur", rubble: "gruz", difficult: "trudny teren", water: "woda", highGround: "wzniesienie", hazard: "zagrożenie", cover: "osłona" })[terrain];
}
function key(position: GridPosition): string { return `${position.x},${position.y}`; }
