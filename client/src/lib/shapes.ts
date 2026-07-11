/**
 * Answer-tile identity: color + SHAPE, so colorblind players can always tell tiles
 * apart (DESIGN.md: "color is never the only signal"). Index 0..3 maps to the four
 * signature tiles; true/false uses a fixed mapping (True = green/square, False =
 * red/triangle) per DESIGN.md.
 */
export type ShapeKind = "triangle" | "diamond" | "circle" | "square";

export interface TileStyle {
  /** CSS var reference for the solid tile background. */
  colorVar: string;
  /** Hex (used for reveal distribution bars / glyph strokes). */
  hex: string;
  shape: ShapeKind;
  /** The gold tile needs dark text to stay ≥4.5:1 contrast. */
  darkText: boolean;
  label: string;
}

const MC: TileStyle[] = [
  { colorVar: "var(--answer-a)", hex: "#e21b3c", shape: "triangle", darkText: false, label: "red triangle" },
  { colorVar: "var(--answer-b)", hex: "#1368ce", shape: "diamond", darkText: false, label: "blue diamond" },
  { colorVar: "var(--answer-c)", hex: "#d89e00", shape: "circle", darkText: true, label: "gold circle" },
  { colorVar: "var(--answer-d)", hex: "#26890c", shape: "square", darkText: false, label: "green square" },
];

/**
 * Style for an option tile. For true/false (2 options) the contract guarantees
 * options are ["True","False"]; we map True -> green square, False -> red triangle.
 */
export function tileStyleFor(optionIndex: number, isTrueFalse: boolean): TileStyle {
  if (isTrueFalse) {
    // index 0 = "True" -> green/square (MC[3]); index 1 = "False" -> red/triangle (MC[0]).
    return optionIndex === 0 ? MC[3] : MC[0];
  }
  return MC[optionIndex % MC.length];
}
