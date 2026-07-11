# Quizmaster — Visual Design Spec

Source: `ui-ux-pro-max` design system (Vibrant & Block-based). This is the source of truth for
the frontend. Persisted long-form system in `design-system/quizmaster/MASTER.md`.

## Design language

**Vibrant & Block-based** — bold, energetic, playful, high color contrast, geometric shapes,
large type, generous spacing. Party-game feel. Full light + dark support.

## Tokens

```css
:root {
  /* Brand */
  --color-primary: #2563EB;      /* quiz blue */
  --color-on-primary: #FFFFFF;
  --color-secondary: #7C3AED;    /* purple */
  --color-accent: #F59E0B;       /* gold — leaderboard / CTA highlight */
  --color-background: #EFF6FF;
  --color-foreground: #0F172A;
  --color-muted: #F1F5FD;
  --color-border: #E4ECFC;
  --color-destructive: #DC2626;
  --color-ring: #2563EB;

  /* Answer tiles — color + SHAPE (never color alone; a11y color-not-only) */
  --answer-a: #E21B3C;  /* red    — triangle ▲ */
  --answer-b: #1368CE;  /* blue   — diamond ◆ */
  --answer-c: #D89E00;  /* gold   — circle  ● */
  --answer-d: #26890C;  /* green  — square  ■ */

  --radius: 16px;
  --shadow-block: 0 6px 0 rgba(15,23,42,0.18); /* chunky "block" shadow */
}
```
Dark mode: desaturate surfaces, keep tile colors but verify white-text contrast (gold tile uses
`#0F172A` text, others use white). Provide `@media (prefers-color-scheme: dark)` + a `data-theme`
override.

## Type

- Headings: **Righteous** (display). Body/UI: **Poppins** (300–700).
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48. Base body 16px (≥16px on mobile to avoid iOS zoom).
- Timers, scores, counts: **tabular figures** (`font-variant-numeric: tabular-nums`) to prevent
  layout shift as numbers tick.

## The answer grid (the signature component)

- **4-option MC:** 2×2 grid on mobile, 2×2 (larger) on desktop. Each tile: solid answer color,
  a **shape glyph** top-left (triangle/diamond/circle/square), the option text, big tap target
  (min height ~96px mobile, ≥44px always), chunky `--shadow-block`, `scale-98` on press.
- **True/False:** 2 full-width stacked tiles — True = green/square, False = red/triangle.
- Shape + color means colorblind players still distinguish tiles; the reveal also uses a check/x
  icon, not just color.
- After answer submitted: dim the un-chosen tiles, pulse the chosen one, show "Locked in" — but
  **do not reveal correctness** until the server's reveal phase.

## Motion (respect prefers-reduced-motion everywhere)

- 200–300ms, ease-out entering / ease-in exiting. Animate transform/opacity only.
- Countdown ring animates smoothly but is driven by server time, not a naive client interval.
- Leaderboard rows animate position changes (FLIP/transform) — the "who jumped" moment.
- Reveal: correct tile pops (scale 1.0→1.05→1.0) + distribution bars grow from 0.
- Loading (generation): skeleton/shimmer + rotating "Writing your quiz…" copy, not a frozen screen.
- Max 1–2 animated elements per view; reduced-motion collapses to instant state changes.

## Per-screen notes

1. **Landing / Create** — hero, one primary CTA. Logged-out: "Sign in with Google" to create;
   anyone can join via code without login. Logged-in: topic textarea, count (5–20), difficulty
   (easy/med/hard segmented), timer (10/20/30s segmented), big **Generate** CTA.
2. **Generating** — full-screen shimmer + status copy; no interaction.
3. **Lobby** — huge room **CODE** + copy-link button + QR optional; live player list (staggered
   entrance 30–50ms/item); creator gets the single primary **Start** button; others see "Waiting…".
4. **Question** — top: server countdown ring + question number + question text; below: the answer
   grid. Score/nickname in a slim header.
5. **Reveal** — correct answer highlighted (check icon), per-option **distribution bars**, and a
   celebratory **"+830"** for the player. ~5s.
6. **Leaderboard** — top ranks, gold accent for #1, animated row reordering. ~5s.
7. **Final results** — podium (1/2/3) with gold/silver/bronze, full ranking below, "Play again"
   (creator) / "Back home".

## Accessibility floor

Contrast ≥4.5:1 for text (verify gold tile), visible focus rings, keyboard-answerable question
grid, `aria-live` for phase changes and countdown milestones, color never the only signal
(shapes + icons), touch targets ≥44px, no-zoom disabled.
