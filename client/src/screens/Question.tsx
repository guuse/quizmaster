import { useMemo } from "react";
import { Shell } from "../components/Shell";
import { CountdownRing } from "../components/CountdownRing";
import { AnswerTile } from "../components/AnswerTile";
import { LiveRegion } from "../components/LiveRegion";
import { GameTopBar } from "../components/GameTopBar";
import { useRoom } from "../context/RoomContext";
import { useCountdown } from "../lib/useCountdown";
import { cn } from "../lib/util";

export function Question() {
  const { snapshot, localAnswer, submitAnswer, clockOffsetMs } = useRoom();
  const q = snapshot?.question ?? null;
  const { secondsLeft, fraction, expired } = useCountdown(
    q?.questionStartedAt ?? null,
    q?.questionEndsAt ?? null,
    clockOffsetMs,
  );

  const isTrueFalse = q?.type === "true_false";
  // youAnswered comes from the server snapshot; localAnswer is our optimistic lock.
  const locked = !!localAnswer || !!snapshot?.youAnswered;
  const selectedIndex = localAnswer?.optionIndex ?? null;

  const liveMsg = useMemo(() => {
    if (!q) return "";
    if (locked) return "Answer locked in. Waiting for the reveal.";
    if (secondsLeft <= 5) return `${secondsLeft} seconds left.`;
    return `Question ${q.index + 1} of ${q.total}. ${q.text}`;
    // Only re-announce on meaningful changes.
  }, [q, locked, secondsLeft <= 5]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return null;

  return (
    <Shell wide testId="phase-question">
      <LiveRegion message={liveMsg} />
      <GameTopBar rightLabel={`Q${q.index + 1} / ${q.total}`} />

      <div className="mt-4 flex items-start gap-3">
        <CountdownRing fraction={fraction} secondsLeft={secondsLeft} />
        <h1 className="font-display text-2xl leading-tight text-ink">{q.text}</h1>
      </div>

      <div
        className={cn(
          "mt-auto pt-6",
          isTrueFalse ? "flex flex-col gap-2.5" : "grid grid-cols-2 gap-2.5",
        )}
      >
        {q.options.map((text, i) => (
          <AnswerTile
            key={i}
            optionIndex={i}
            text={text}
            isTrueFalse={isTrueFalse}
            fullWidth={isTrueFalse}
            onSelect={submitAnswer}
            disabled={locked || expired}
            selected={selectedIndex === i}
            dimmed={locked && selectedIndex !== i}
          />
        ))}
      </div>

      <p className="mt-4 text-center text-sm font-bold text-sub" aria-hidden="true">
        {locked
          ? "Locked in — hang tight for the reveal."
          : expired
            ? "Time's up!"
            : "Tap your answer. Faster = more points."}
      </p>
    </Shell>
  );
}
