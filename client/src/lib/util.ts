/** Tiny className joiner (no dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Two-letter initials from a nickname. */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#7c3aed", "#2563eb"];

/** Deterministic avatar color from a stable id so a player keeps the same color. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Thousands separator for scores (tabular figures keep it from shifting). */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
