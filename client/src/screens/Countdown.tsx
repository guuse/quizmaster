import { useEffect, useState } from "react";
import { Shell } from "../components/Shell";
import { GameTopBar } from "../components/GameTopBar";
import { LiveRegion } from "../components/LiveRegion";
import { useRoom } from "../context/RoomContext";

/**
 * The "3-2-1" before every question (server-timed via `countdown.endsAt`, so it's the same
 * for everyone). Shown before the first question and between questions.
 */
export function Countdown() {
  const { snapshot, clockOffsetMs } = useRoom();
  const cd = snapshot?.countdown;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  if (!cd) return null;
  // Use SERVER time (client clock + offset) so a skewed PC clock doesn't skip the countdown.
  const secs = Math.max(0, Math.ceil((cd.endsAt - (now + clockOffsetMs)) / 1000));
  const label = secs > 0 ? String(secs) : "Go!";

  return (
    <Shell wide testId="phase-countdown">
      <LiveRegion message={`Question ${cd.questionNumber} of ${cd.total} starts in ${secs}`} assertive />
      <GameTopBar rightLabel={`Q${cd.questionNumber} / ${cd.total}`} />

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary">
          Question {cd.questionNumber} of {cd.total}
        </p>
        <p className="font-display text-2xl text-sub">Get ready…</p>
        {/* key={label} re-plays the pop each tick */}
        <div
          key={label}
          className="grid h-40 w-40 place-items-center rounded-full bg-primary text-on-primary shadow-block motion-safe:animate-pop"
        >
          <span className="tnum font-display text-7xl">{label}</span>
        </div>
      </div>
    </Shell>
  );
}
