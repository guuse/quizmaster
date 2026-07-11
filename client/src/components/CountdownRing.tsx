import { cn } from "../lib/util";

/**
 * Server-driven countdown ring. `fraction` is the share of time REMAINING (1 → 0),
 * computed by useCountdown from the server's questionEndsAt — this component only draws.
 * SVG stroke-dashoffset gives a smooth sweep; the digit uses tabular figures so it never
 * shifts as it ticks. Turns amber → red in the final stretch.
 */
export function CountdownRing({
  fraction,
  secondsLeft,
  size = 56,
}: {
  fraction: number;
  secondsLeft: number;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, fraction)) * c;
  const urgent = secondsLeft <= 5;

  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      role="timer"
      aria-hidden="true"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--answer-a)" : "var(--color-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - dash}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 200ms ease" }}
        />
      </svg>
      <span
        className={cn(
          "tnum absolute inset-0 grid place-items-center font-display text-lg",
          urgent && "text-[var(--answer-a)]",
        )}
      >
        {secondsLeft}
      </span>
    </div>
  );
}
