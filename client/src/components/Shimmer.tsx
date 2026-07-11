import { cn } from "../lib/util";

/**
 * Skeleton bar with a moving sheen (used by the generating state). Under
 * prefers-reduced-motion the global CSS reset freezes the sheen to a static block —
 * "not a frozen screen" still holds because the rotating copy carries the progress.
 */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(148,163,184,0.25), transparent)",
        }}
      />
    </div>
  );
}
