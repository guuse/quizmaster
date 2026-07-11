/**
 * Abstract, deterministic "profile photo" generated from a name — a small symmetric
 * identicon (GitHub-style). Same name → same picture, so players recognize each other on
 * the lobby, leaderboard, and the answer reveal.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Avatar({ name, seed, size = 26 }: { name: string; seed?: string; size?: number }) {
  const h = hash((name || seed || "?").toLowerCase());
  const hue = h % 360;
  const fg = `hsl(${hue} 62% 45%)`;
  const bg = `hsl(${hue} 45% 93%)`;

  // 5×5 grid, left half (cols 0,1,2) mirrored to the right → a symmetric pattern.
  const cells: [number, number][] = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      if ((h >> (col * 5 + row)) & 1) {
        cells.push([col, row]);
        if (col < 2) cells.push([4 - col, row]);
      }
    }
  }

  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: Math.max(4, Math.round(size * 0.28)), background: bg }}
    >
      <svg width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges">
        {cells.map(([c, r], i) => (
          <rect key={i} x={c} y={r} width={1} height={1} fill={fg} />
        ))}
      </svg>
    </span>
  );
}
