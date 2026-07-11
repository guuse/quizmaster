import { useEffect, useState } from "react";
import { Shimmer } from "../components/Shimmer";
import { LiveRegion } from "../components/LiveRegion";

const COPY = [
  "Writing your quiz…",
  "Dreaming up tricky options…",
  "Sealing the answers away…",
  "Nobody sees the answers — not even you.",
  "Almost ready…",
];

/**
 * Full-screen loading state while POST /api/quizzes is in flight (synchronous, a few
 * seconds). Shimmer + rotating copy so it never reads as a frozen screen (DESIGN.md).
 */
export function Generating({ count }: { count: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % COPY.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-10 flex flex-col items-center gap-5 text-center" aria-busy="true">
      <LiveRegion message="Generating your quiz. Please wait." />
      <div
        className="h-16 w-16 rounded-full border-[6px] border-muted border-t-accent motion-safe:animate-spin"
        aria-hidden="true"
        style={{ animationDuration: "1s" }}
      />
      <div>
        <p className="font-display text-2xl">{COPY[i]}</p>
        <p className="mt-1 text-sm text-sub">
          {count} questions · Claude is on it.
        </p>
      </div>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-4/5" />
        <Shimmer className="h-3 w-3/5" />
      </div>
    </div>
  );
}
