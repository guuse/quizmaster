import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { effectiveTheme, toggleTheme } from "../lib/theme";

/** Light/dark toggle. The document may already have a persisted data-theme (set pre-paint). */
export function ThemeToggle() {
  const [theme, setThemeState] = useState(() => effectiveTheme());
  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleTheme())}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-line bg-panel px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:border-primary"
    >
      {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
