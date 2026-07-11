import type { ShapeKind } from "../lib/shapes";

/**
 * The four answer shapes as SVG (triangle / diamond / circle / square). Shape is the
 * colorblind-safe signal that backs every tile color. `aria-hidden` because the option
 * text is the accessible label; the shape name is folded into the tile's aria-label.
 */
export function ShapeGlyph({
  shape,
  size = 24,
  className,
  fill = "currentColor",
}: {
  shape: ShapeKind;
  size?: number;
  className?: string;
  fill?: string;
}) {
  const common = { fill, stroke: "none" };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {shape === "triangle" && <path d="M12 3 L22 20 L2 20 Z" {...common} />}
      {shape === "diamond" && <path d="M12 2 L22 12 L12 22 L2 12 Z" {...common} />}
      {shape === "circle" && <circle cx="12" cy="12" r="10" {...common} />}
      {shape === "square" && <rect x="3" y="3" width="18" height="18" rx="2" {...common} />}
    </svg>
  );
}
