import { Check, X } from "lucide-react";
import { tileStyleFor } from "../lib/shapes";
import { ShapeGlyph } from "./ShapeGlyph";
import { cn } from "../lib/util";

/**
 * The signature answer tile: solid color + shape glyph + text, a big tap target
 * (≥44px, ~96px on mobile). It renders four visual states without ever leaking
 * correctness before the reveal:
 *   - idle        : tappable
 *   - selected    : the option THIS player locked ("Locked in", pulse)
 *   - dimmed      : an un-chosen option after this player locked
 *   - reveal      : correct tile outlined + check; the player's wrong pick gets an X
 */
export interface AnswerTileProps {
  optionIndex: number;
  text: string;
  isTrueFalse: boolean;
  onSelect?: (index: number) => void;
  disabled?: boolean;
  /** This player picked this tile. */
  selected?: boolean;
  /** Another tile is selected — dim this one. */
  dimmed?: boolean;
  /** Reveal phase styling. */
  revealed?: boolean;
  isCorrect?: boolean;
  fullWidth?: boolean;
}

export function AnswerTile({
  optionIndex,
  text,
  isTrueFalse,
  onSelect,
  disabled,
  selected,
  dimmed,
  revealed,
  isCorrect,
  fullWidth,
}: AnswerTileProps) {
  const style = tileStyleFor(optionIndex, isTrueFalse);
  const glyphColor = style.darkText ? "#0f172a" : "#ffffff";
  const showWrongMark = revealed && selected && !isCorrect;

  const stateLabel = revealed
    ? isCorrect
      ? "correct answer"
      : selected
        ? "your answer, incorrect"
        : undefined
    : selected
      ? "locked in"
      : undefined;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(optionIndex)}
      aria-pressed={selected}
      aria-label={`${text}. ${style.label}${stateLabel ? `, ${stateLabel}` : ""}`}
      className={cn(
        "group relative flex flex-col justify-between gap-2 rounded-tile p-3.5 text-left font-bold",
        "transition-transform duration-100 ease-out",
        "shadow-tile active:translate-y-[3px] active:shadow-tile-pressed",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white",
        fullWidth ? "min-h-[64px] flex-row items-center" : "min-h-[96px]",
        style.darkText ? "text-[#0f172a]" : "text-white",
        dimmed && !revealed && "opacity-45 saturate-[0.7]",
        revealed && !isCorrect && "opacity-60",
        selected && !revealed && "animate-pulseglow ring-4 ring-white/80",
        revealed && isCorrect && "animate-pop ring-4 ring-white outline outline-[3px] outline-offset-2",
        disabled && "cursor-default",
        !disabled && "cursor-pointer",
      )}
      style={{
        backgroundColor: style.colorVar,
        // Correct tile gets a bold outline built from its own color for extra contrast.
        ...(revealed && isCorrect
          ? { outlineColor: style.hex }
          : {}),
      }}
    >
      <div className={cn("flex items-center gap-2.5", fullWidth && "flex-1")}>
        <ShapeGlyph shape={style.shape} size={fullWidth ? 26 : 22} fill={glyphColor} />
        <span className={cn(fullWidth ? "text-base" : "text-sm leading-tight", "font-bold")}>
          {text}
        </span>
      </div>

      {/* Reveal marks — icon, not color alone. */}
      {revealed && isCorrect && (
        <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[#26890c]">
          <Check size={18} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {showWrongMark && (
        <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#e21b3c]">
          <X size={18} strokeWidth={3} aria-hidden="true" />
        </span>
      )}

      {/* "Locked in" badge (pre-reveal only). */}
      {selected && !revealed && (
        <span
          className={cn(
            "self-start rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
            fullWidth && "ml-auto self-center",
          )}
        >
          Locked in
        </span>
      )}
    </button>
  );
}
