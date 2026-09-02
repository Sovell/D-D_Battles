import { Application, extend } from "@pixi/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Assets, Container, Graphics, Rectangle, Sprite, Texture, type Application as PixiApplication } from "pixi.js";
import type { BattleState, GridPosition } from "../core/domain/types";
import { createBattlefieldViewModel } from "../presentation/battlefield-view-model";
import { getTerrainArt, type TerrainArt } from "../presentation/terrain-art";
import { getUnitArt } from "../presentation/unit-art";
import { centeredOrigin, zoomCameraAtPoint, type CameraState } from "./board-camera";

extend({ Container, Graphics, Sprite });

export function PixiBattlefield({ state, showMovement, abilityId, selectedUnitId, onCell, onUnit }: { state: BattleState; showMovement: boolean; abilityId?: string; selectedUnitId?: string; onCell(position: GridPosition): void; onUnit(id: string): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [application, setApplication] = useState<PixiApplication | null>(null);
  const [hoveredCell, setHoveredCell] = useState<GridPosition>();
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | undefined>(undefined);
  const suppressTapRef = useRef(false);
  const model = useMemo(() => createBattlefieldViewModel(state, showMovement, abilityId, selectedUnitId, hoveredCell), [abilityId, hoveredCell, selectedUnitId, state, showMovement]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => { const rect = host.getBoundingClientRect(); setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) }); };
    const observer = new ResizeObserver(update); observer.observe(host); update(); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { application?.renderer.resize(size.width, size.height); }, [application, size]);
  const cell = Math.max(22, Math.min(48, Math.floor(Math.min((size.width - 32) / model.width, (size.height - 32) / model.height))));
  const worldSize = { width: model.width * cell, height: model.height * cell };
  const origin = centeredOrigin(size, worldSize, camera.zoom);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = host.getBoundingClientRect();
      const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      setCamera((current) => zoomCameraAtPoint(current, current.zoom * (event.deltaY < 0 ? 1.14 : 0.88), pointer, size, worldSize));
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [size.width, size.height, worldSize.width, worldSize.height]);
  useEffect(() => { setCamera({ zoom: 1, panX: 0, panY: 0 }); }, [state.map.id]);

  const zoomAtCenter = (requestedZoom: number) => setCamera((current) => zoomCameraAtPoint(current, requestedZoom, { x: size.width / 2, y: size.height / 2 }, size, worldSize));
  const acceptTap = () => { if (!suppressTapRef.current) return true; suppressTapRef.current = false; return false; };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
    if ((event.target as Element).closest(".board-controls")) return;
    suppressTapRef.current = false;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4) {
      drag.moved = true;
      suppressTapRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.moved) setCamera((current) => ({ ...current, panX: current.panX + dx, panY: current.panY + dy }));
  };
  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <div className={`battlefield ${dragging ? "dragging" : ""}`} ref={hostRef} aria-label="Pole bitwy PixiJS" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
    <Application antialias backgroundColor={0x090b0c} height={size.height} width={size.width} resizeTo={hostRef} onInit={setApplication}>
      <pixiContainer scale={camera.zoom} x={origin.x + camera.panX} y={origin.y + camera.panY}>
        {model.cells.map((item) => <pixiContainer key={`${item.position.x},${item.position.y}`} eventMode="static" cursor={item.targetable || showMovement ? "pointer" : "default"} onPointerOver={() => item.targetable && setHoveredCell(item.position)} onPointerOut={() => setHoveredCell((current) => current && current.x === item.position.x && current.y === item.position.y ? undefined : current)} onPointerTap={() => acceptTap() && onCell(item.position)} x={item.position.x * cell} y={item.position.y * cell}>
          <pixiGraphics draw={(graphics) => {
          const colors: Record<string, number> = { wall: 0x050708, floor: 0x34383a, rubble: 0x4a4339, difficult: 0x493b32, water: 0x243d49, highGround: 0x5a5145, hazard: 0x6b2b1f, cover: 0x4c4f4d };
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
        {model.tokens.filter((token) => !token.dead).map((token) => <pixiContainer key={token.id} x={token.position.x * cell} y={token.position.y * cell} eventMode="none">
          <pixiGraphics draw={(graphics) => { graphics.clear().circle(cell / 2, cell / 2, cell * 0.34).fill(token.side === "heroes" ? 0x173944 : 0x401f1c); }} />
          <TokenSprite artVariant={token.artVariant} cell={cell} definitionId={token.definitionId} />
          <pixiGraphics draw={(graphics) => { graphics.clear().circle(cell / 2, cell / 2, cell * 0.34).stroke({ color: token.targetable ? 0x79c9e8 : token.selected ? 0xf0dfb4 : token.active ? 0xe7c66b : 0x17191a, width: token.targetable || token.selected || token.active ? 3 : 1 }); if (token.targetable || token.selected) graphics.circle(cell / 2, cell / 2, cell * 0.42).stroke({ color: token.targetable ? 0x79c9e8 : 0xf0dfb4, width: 2, alpha: 0.75 }); graphics.rect(cell * 0.15, cell * 0.82, cell * 0.7, 4).fill(0x181818); graphics.rect(cell * 0.15, cell * 0.82, cell * 0.7 * token.hpRatio, 4).fill(token.hpRatio > 0.4 ? 0x6dae66 : 0xb74b42); }} />
        </pixiContainer>)}
      </pixiContainer>
    </Application>
    <div className="token-hit-layer">{model.tokens.filter((token) => !token.dead).map((token) => <button aria-label={`Zaznacz ${token.name}`} className="token-hit-target" key={token.id} onClick={() => acceptTap() && onUnit(token.id)} onPointerDown={(event) => { if (event.button === 0 && !event.shiftKey) event.stopPropagation(); }} style={{ left: origin.x + camera.panX + token.position.x * cell * camera.zoom, top: origin.y + camera.panY + token.position.y * cell * camera.zoom, width: cell * camera.zoom, height: cell * camera.zoom }} type="button" />)}</div>
    <span className="board-help">KÓŁKO: ZOOM · SHIFT/ŚRODKOWY + PRZECIĄGNIJ: PRZESUŃ</span>
    <div className="board-controls" aria-label="Sterowanie mapą" onPointerDown={(event) => event.stopPropagation()}>
      <button aria-label="Oddal mapę" onClick={() => zoomAtCenter(camera.zoom - 0.25)} type="button">−</button>
      <button aria-label="Wycentruj mapę i przywróć zoom" className="zoom-level" onClick={() => setCamera({ zoom: 1, panX: 0, panY: 0 })} type="button">{Math.round(camera.zoom * 100)}%</button>
      <button aria-label="Przybliż mapę" onClick={() => zoomAtCenter(camera.zoom + 0.25)} type="button">+</button>
    </div>
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
