import { Application, extend } from "@pixi/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Assets, Container, Graphics, Rectangle, Sprite, Texture, type Application as PixiApplication, type FederatedPointerEvent } from "pixi.js";
import type { BattleState, GridPosition } from "../core/domain/types";
import { createBattlefieldViewModel } from "../presentation/battlefield-view-model";
import { getTerrainArt, type TerrainArt } from "../presentation/terrain-art";
import { getUnitArt } from "../presentation/unit-art";

extend({ Container, Graphics, Sprite });

export function PixiBattlefield({ state, showMovement, abilityId, selectedUnitId, onCell, onUnit }: { state: BattleState; showMovement: boolean; abilityId?: string; selectedUnitId?: string; onCell(position: GridPosition): void; onUnit(id: string): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [application, setApplication] = useState<PixiApplication | null>(null);
  const [hoveredCell, setHoveredCell] = useState<GridPosition>();
  const model = useMemo(() => createBattlefieldViewModel(state, showMovement, abilityId, selectedUnitId, hoveredCell), [abilityId, hoveredCell, selectedUnitId, state, showMovement]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => { const rect = host.getBoundingClientRect(); setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) }); };
    const observer = new ResizeObserver(update); observer.observe(host); update(); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { application?.renderer.resize(size.width, size.height); }, [application, size]);
  const cell = Math.max(22, Math.min(48, Math.floor(Math.min((size.width - 32) / model.width, (size.height - 32) / model.height))));
  const offsetX = (size.width - model.width * cell) / 2;
  const offsetY = (size.height - model.height * cell) / 2;
  return <div className="battlefield" ref={hostRef} aria-label="Pole bitwy PixiJS">
    <Application antialias backgroundColor={0x090b0c} height={size.height} width={size.width} resizeTo={hostRef} onInit={setApplication}>
      <pixiContainer x={offsetX} y={offsetY}>
        {model.cells.map((item) => <pixiContainer key={`${item.position.x},${item.position.y}`} eventMode="static" cursor={item.targetable || showMovement ? "pointer" : "default"} onPointerOver={() => item.targetable && setHoveredCell(item.position)} onPointerOut={() => setHoveredCell((current) => current && current.x === item.position.x && current.y === item.position.y ? undefined : current)} onPointerTap={() => onCell(item.position)} x={item.position.x * cell} y={item.position.y * cell}>
          <pixiGraphics draw={(graphics) => {
          const colors: Record<string, number> = { wall: 0x101417, floor: 0x34383a, rubble: 0x4a4339, difficult: 0x493b32, water: 0x243d49, highGround: 0x5a5145, hazard: 0x6b2b1f, cover: 0x4c4f4d };
          graphics.clear().rect(1, 1, cell - 2, cell - 2).fill(colors[item.terrain]);
          }} />
          <TerrainSprite art={getTerrainArt(state.map.theme, item.terrain)} cell={cell} />
          <pixiGraphics draw={(graphics) => {
            const highlightColor = item.highlight === "movement" ? 0x789365 : item.highlight === "ability" ? 0x39718d : 0x855393;
            const strokeColor = item.highlight === "ability" ? 0x79c9e8 : item.highlight === "area" ? 0xd59be0 : item.objectiveHp && item.objectiveHp > 0 ? 0xc75caf : 0x171a1c;
            graphics.clear();
            if (item.highlight) graphics.rect(1, 1, cell - 2, cell - 2).fill({ color: highlightColor, alpha: 0.55 });
            graphics.rect(1, 1, cell - 2, cell - 2).stroke({ color: strokeColor, width: item.highlight === "ability" || item.highlight === "area" ? 2 : 1 });
            if (item.objectiveHp && item.objectiveHp > 0) graphics.circle(cell / 2, cell / 2, cell * 0.2).fill(0xb45aa2);
          }} />
        </pixiContainer>)}
        {model.tokens.filter((token) => !token.dead).map((token) => <pixiContainer key={token.id} x={token.position.x * cell} y={token.position.y * cell} eventMode="static" cursor="pointer" onPointerTap={(event: FederatedPointerEvent) => { event.stopPropagation(); onUnit(token.id); }}>
          <pixiGraphics draw={(graphics) => { graphics.clear().circle(cell / 2, cell / 2, cell * 0.34).fill(token.side === "heroes" ? 0x173944 : 0x401f1c); }} />
          <TokenSprite artVariant={token.artVariant} cell={cell} definitionId={token.definitionId} />
          <pixiGraphics draw={(graphics) => { graphics.clear().circle(cell / 2, cell / 2, cell * 0.34).stroke({ color: token.targetable ? 0x79c9e8 : token.selected ? 0xf0dfb4 : token.active ? 0xe7c66b : 0x17191a, width: token.targetable || token.selected || token.active ? 3 : 1 }); if (token.targetable || token.selected) graphics.circle(cell / 2, cell / 2, cell * 0.42).stroke({ color: token.targetable ? 0x79c9e8 : 0xf0dfb4, width: 2, alpha: 0.75 }); graphics.rect(cell * 0.15, cell * 0.82, cell * 0.7, 4).fill(0x181818); graphics.rect(cell * 0.15, cell * 0.82, cell * 0.7 * token.hpRatio, 4).fill(token.hpRatio > 0.4 ? 0x6dae66 : 0xb74b42); }} />
        </pixiContainer>)}
      </pixiContainer>
    </Application>
  </div>;
}

function TerrainSprite({ art, cell }: { art?: TerrainArt; cell: number }) {
  const [texture, setTexture] = useState<Texture>();
  useEffect(() => {
    let active = true;
    let cropped: Texture | undefined;
    setTexture(undefined);
    if (art) Assets.load<Texture>(art.url).then((sheet) => {
      cropped = art.frame ? new Texture({ source: sheet.source, frame: new Rectangle(art.frame.x, art.frame.y, art.frame.width, art.frame.height) }) : undefined;
      const next = cropped ?? sheet;
      if (active) setTexture(next); else cropped?.destroy(false);
    });
    return () => { active = false; cropped?.destroy(false); };
  }, [art]);
  if (!texture || !art) return null;
  return <pixiSprite alpha={art.alpha ?? 1} height={cell - 2} texture={texture} width={cell - 2} x={1} y={1} />;
}

function TokenSprite({ definitionId, artVariant, cell }: { definitionId: string; artVariant: number; cell: number }) {
  const art = useMemo(() => getUnitArt(definitionId, artVariant, "token"), [artVariant, definitionId]);
  const [texture, setTexture] = useState<Texture>();
  useEffect(() => {
    let active = true;
    let cropped: Texture | undefined;
    if (art) Assets.load<Texture>(art.url).then((sheet) => {
      cropped = new Texture({ source: sheet.source, frame: new Rectangle(art.x, art.y, art.width, art.height) });
      if (active) setTexture(cropped); else cropped.destroy(false);
    });
    return () => { active = false; cropped?.destroy(false); };
  }, [art]);
  if (!texture || !art) return null;
  const height = cell * 0.68;
  const width = Math.min(cell * 0.62, height * art.width / art.height);
  return <pixiSprite anchor={0.5} height={height} texture={texture} width={width} x={cell / 2} y={cell * 0.48} />;
}
