export type Theme = "light" | "dark";

const KEY = "qm.theme";

/** The theme actually in effect right now (explicit override or OS preference). */
export function effectiveTheme(): Theme {
  const override = document.documentElement.getAttribute("data-theme");
  if (override === "light" || override === "dark") return override;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): Theme {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
