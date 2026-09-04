import { getUnitArt } from "../presentation/unit-art";

export function UnitPortrait({ definitionId, variant = 0, kind = "portrait", className = "", label }: { definitionId: string; variant?: number; kind?: "portrait" | "token"; className?: string; label?: string }) {
  const art = getUnitArt(definitionId, variant, kind);
  return <span aria-label={label} className={`unit-art ${className}`} role={label ? "img" : undefined}>
    {art && <svg aria-hidden="true" preserveAspectRatio="xMidYMin slice" viewBox={`${art.x} ${art.y} ${art.width} ${art.height}`}><image height={art.sheetHeight} href={art.url} preserveAspectRatio="none" width={art.sheetWidth} x={0} y={0} /></svg>}
    {!art && <b className="unit-art-fallback" aria-hidden="true">{definitionId.split("-").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</b>}
  </span>;
}
