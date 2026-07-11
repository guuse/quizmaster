import { Link } from "react-router-dom";
import { cn } from "../lib/util";

/** Quizmaster wordmark + block "Q" mark. Links home unless `static` is set. */
export function Logo({ size = "md", asLink = true }: { size?: "sm" | "md" | "lg"; asLink?: boolean }) {
  const markSize = size === "lg" ? 52 : size === "sm" ? 34 : 44;
  const textCls =
    size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-lg" : "text-2xl";

  const inner = (
    <span className="inline-flex items-center gap-3">
      <span
        className="grid place-items-center rounded-xl font-display text-white shadow-block"
        style={{
          width: markSize,
          height: markSize,
          background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
          fontSize: Math.round(markSize * 0.5),
        }}
        aria-hidden="true"
      >
        Q
      </span>
      <span className={cn("font-display text-ink", textCls)}>
        Quiz<span className="text-accent">master</span>
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" className="rounded-lg" aria-label="Quizmaster home">
      {inner}
    </Link>
  );
}
