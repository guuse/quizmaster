import { Check } from "lucide-react";
import { Shell } from "../components/Shell";
import { GameTopBar } from "../components/GameTopBar";
import { ShapeGlyph } from "../components/ShapeGlyph";
import { LiveRegion } from "../components/LiveRegion";
import { useRoom } from "../context/RoomContext";
import { tileStyleFor } from "../lib/shapes";
import { cn, fmt } from "../lib/util";

export function Reveal() {
  const { snapshot } = useRoom();
  const reveal = snapshot?.reveal;
  if (!reveal) return null;

  const isTrueFalse = reveal.distribution.length === 2;
  const total = reveal.distribution.reduce((s, o) => s + o.count, 0);
  const correct = reveal.distribution.find((o) => o.isCorrect);
  const correctStyle = correct ? tileStyleFor(correct.index, isTrueFalse) : null;
  const you = reveal.you;

  const liveMsg = correct
    ? `The correct answer was ${correct.text}. ${
        you ? (you.wasCorrect ? `You earned ${you.earned} points.` : "You didn't score this round.") : ""
      }`
    : "";

  return (
    <Shell wide testId="phase-reveal">
      <LiveRegion message={liveMsg} assertive />
      <GameTopBar rightLabel="Reveal" />

      {correct && correctStyle && (
        <div className="mt-4 flex items-center gap-3">
          <span
            className="grid h-11 w-11 flex-none place-items-center rounded-xl motion-safe:animate-pop"
            style={{ backgroundColor: correctStyle.colorVar }}
          >
            <ShapeGlyph shape={correctStyle.shape} size={24} fill={correctStyle.darkText ? "#0f172a" : "#fff"} />
          </span>
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-sub">Correct answer</p>
            <p className="font-display text-2xl text-ink">{correct.text}</p>
          </div>
          <Check size={24} className="ml-auto text-[var(--answer-d)]" aria-hidden="true" />
        </div>
      )}

      <section className="mt-5" aria-label="Answer distribution">
        <div className="flex flex-col gap-2.5">
          {reveal.distribution.map((opt) => {
            const style = tileStyleFor(opt.index, isTrueFalse);
            const pct = total > 0 ? (opt.count / total) * 100 : 0;
            return (
              <div
                key={opt.index}
                className="flex items-center gap-2.5"
                aria-label={`${opt.text}: ${opt.count} player${opt.count === 1 ? "" : "s"}${opt.isCorrect ? ", correct answer" : ""}`}
              >
                <ShapeGlyph shape={style.shape} size={18} fill={style.hex} className="flex-none" />
                {/* Colored bar sized to the share of votes; the count lives inside it, so
                    text always sits on the tile color (never on the light track). */}
                <div className="h-8 flex-1">
                  <div
                    className={cn(
                      "tnum flex h-full min-w-[2.4rem] origin-left items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold motion-safe:animate-growbar",
                      style.darkText ? "text-[#0f172a]" : "text-white",
                    )}
                    style={{ width: `${pct}%`, backgroundColor: style.colorVar }}
                  >
                    <span>{opt.count}</span>
                    {opt.isCorrect && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-auto pt-6 text-center">
        {you ? (
          you.wasCorrect ? (
            <>
              <p className="font-display text-5xl text-[var(--answer-d)] motion-safe:animate-pop">
                +{fmt(you.earned)}
              </p>
              <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-sub">
                {you.earned >= 800 ? "Fast & correct" : "Correct"} · {fmt(you.total)} total
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-4xl text-sub">+0</p>
              <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-sub">
                {snapshot?.youAnswered ? "Not this time" : "No answer"} · {fmt(you.total)} total
              </p>
            </>
          )
        ) : null}
      </div>
    </Shell>
  );
}
