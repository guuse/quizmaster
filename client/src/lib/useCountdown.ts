import { useEffect, useRef, useState } from "react";

export interface Countdown {
  /** Whole seconds remaining, rounded up (what the ring digit shows). */
  secondsLeft: number;
  /** Milliseconds remaining, clamped to [0, total]. */
  msLeft: number;
  /** Fraction of time REMAINING in [0, 1] — drives the ring sweep. */
  fraction: number;
  expired: boolean;
}

/**
 * Server-authoritative countdown. Remaining time is derived from the server's
 * `questionEndsAt` (epoch ms) against the current wall clock on every tick — it is NOT
 * a naive local timer that decrements independently, so it stays correct across pauses,
 * tab-throttling, and a mid-question refresh (which rehydrates the same endsAt).
 *
 * `clockOffsetMs` (serverNow - clientNow) corrects clock skew; 0 is fine when client and
 * server clocks are roughly aligned (always true in single-origin dev).
 */
export function useCountdown(
  startedAt: number | null,
  endsAt: number | null,
  clockOffsetMs = 0,
): Countdown {
  const [, force] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (startedAt == null || endsAt == null) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      force((n) => (n + 1) & 0xffff);
      const now = Date.now() + clockOffsetMs;
      // Once expired we can stop repainting.
      if (now < endsAt) {
        raf.current = window.setTimeout(tick, 100) as unknown as number;
      }
    };
    tick();
    return () => {
      stopped = true;
      if (raf.current != null) clearTimeout(raf.current);
    };
  }, [startedAt, endsAt, clockOffsetMs]);

  if (startedAt == null || endsAt == null) {
    return { secondsLeft: 0, msLeft: 0, fraction: 0, expired: true };
  }

  const total = Math.max(1, endsAt - startedAt);
  const now = Date.now() + clockOffsetMs;
  const msLeft = Math.max(0, Math.min(total, endsAt - now));
  return {
    msLeft,
    secondsLeft: Math.ceil(msLeft / 1000),
    fraction: msLeft / total,
    expired: msLeft <= 0,
  };
}
