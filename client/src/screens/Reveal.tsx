import { Check, Clock, X } from "lucide-react";
import { Shell } from "../components/Shell";
import { GameTopBar } from "../components/GameTopBar";
import { ShapeGlyph } from "../components/ShapeGlyph";
import { Avatar } from "../components/Avatar";
import { LiveRegion } from "../components/LiveRegion";
import { useRoom } from "../context/RoomContext";
import { tileStyleFor } from "../lib/shapes";
import { cn, fmt } from "../lib/util";

export function Reveal() {
  const { snapshot } = useRoom();
  const reveal = snapshot?.reveal;
  if (!reveal) return null;

  const isTrueFalse = reveal.distribution.length === 2;
  const correct = reveal.distribution.find((o) => o.isCorrect);
  const you = reveal.you;
  const answered = you?.chosenIndex != null;
  const gotIt = !!you?.wasCorrect;

  const liveMsg = `The correct answer was ${correct?.text ?? ""}. ${
    gotIt ? `Correct — you earned ${you?.earned} points.` : answered ? "That was wrong." : "You didn't answer in time."
  }`;

  return (
    <Shell wide testId="phase-reveal">
      <LiveRegion message={liveMsg} assertive />
      <GameTopBar rightLabel="Reveal" />

      {/* Big, unmistakable verdict for THIS player. */}
      <div
        className={cn(
          "mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-block motion-safe:animate-pop",
          gotIt
            ? "bg-[var(--answer-d)] text-white"
            : answered
              ? "bg-[var(--answer-a)] text-white"
              : "bg-muted text-ink",
        )}
      >
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/25">
          {gotIt ? <Check size={26} strokeWidth={3} /> : answered ? <X size={26} strokeWidth={3} /> : <Clock size={24} />}
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none">
            {gotIt ? "Correct!" : answered ? "Wrong" : "Too slow!"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold opacity-90">
            {gotIt ? `+${fmt(you!.earned)} points` : `Answer: ${correct?.text ?? ""}`}
          </p>
        </div>
        <span className="tnum ml-auto flex-none font-display text-2xl">{fmt(you?.total ?? 0)}</span>
      </div>

      {/* Every option, with who picked it. Correct is green; your pick is tagged. */}
      <section className="mt-4 flex flex-col gap-2" aria-label="What everyone answered">
        {reveal.distribution.map((opt) => {
          const style = tileStyleFor(opt.index, isTrueFalse);
          const yours = you?.chosenIndex === opt.index;
          return (
            <div
              key={opt.index}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5",
                opt.isCorrect ? "border-[var(--answer-d)] bg-[var(--answer-d)]/10" : "border-line bg-panel",
              )}
              aria-label={`${opt.text}: ${opt.count} player${opt.count === 1 ? "" : "s"}${opt.isCorrect ? ", correct" : ""}${yours ? ", your pick" : ""}`}
            >
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-lg"
                style={{ backgroundColor: style.colorVar }}
              >
                <ShapeGlyph shape={style.shape} size={18} fill={style.darkText ? "#0f172a" : "#fff"} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-bold text-ink">{opt.text}</span>
                  {opt.isCorrect && (
                    <Check size={16} strokeWidth={3} className="flex-none text-[var(--answer-d)]" aria-hidden="true" />
                  )}
                  {yours && (
                    <span className="flex-none rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-on-primary">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {opt.players.length === 0 ? (
                    <span className="text-xs text-sub">—</span>
                  ) : (
                    <>
                      {opt.players.slice(0, 10).map((p) => (
                        <Avatar key={p.id} name={p.nickname} seed={p.id} size={22} />
                      ))}
                      {opt.players.length > 10 && (
                        <span className="text-xs font-bold text-sub">+{opt.players.length - 10}</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <span className="tnum flex-none font-display text-lg text-sub">{opt.count}</span>
            </div>
          );
        })}
      </section>
    </Shell>
  );
}
