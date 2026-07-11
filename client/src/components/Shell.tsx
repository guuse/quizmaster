import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "../lib/util";

/**
 * App frame: a slim header (logo + theme toggle + optional right slot) over a centered
 * content column. Mobile-first; `wide` opens the column up for the question grid and
 * leaderboard on larger screens.
 */
export function Shell({
  children,
  right,
  wide,
  headerSlot,
  testId,
}: {
  children: ReactNode;
  right?: ReactNode;
  wide?: boolean;
  headerSlot?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
        {headerSlot}
      </header>
      <main
        data-testid={testId}
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 pb-10 pt-5",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        {children}
      </main>
    </div>
  );
}
