import { getUnitArtBackground } from "../presentation/unit-art";

export function UnitPortrait({ definitionId, variant = 0, kind = "portrait", className = "", label }: { definitionId: string; variant?: number; kind?: "portrait" | "token"; className?: string; label?: string }) {
  const style = getUnitArtBackground(definitionId, variant, kind);
  return <span aria-label={label} className={`unit-art ${className}`} role={label ? "img" : undefined} style={style} />;
}
