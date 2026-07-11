/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens are driven by CSS variables (see index.css) so light/dark
        // resolve automatically. These aliases let Tailwind utilities reference them.
        primary: "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        bg: "var(--color-background)",
        panel: "var(--color-panel)",
        ink: "var(--color-foreground)",
        sub: "var(--color-sub)",
        line: "var(--color-border)",
        muted: "var(--color-muted)",
        destructive: "var(--color-destructive)",
        // Answer tiles — color + SHAPE (never color alone).
        "answer-a": "var(--answer-a)",
        "answer-b": "var(--answer-b)",
        "answer-c": "var(--answer-c)",
        "answer-d": "var(--answer-d)",
      },
      fontFamily: {
        display: ['"Righteous"', "system-ui", "sans-serif"],
        sans: ['"Poppins"', "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "16px",
        tile: "14px",
        xl2: "18px",
      },
      boxShadow: {
        block: "0 6px 0 rgba(15,23,42,0.18)",
        tile: "0 5px 0 rgba(0,0,0,0.28)",
        "tile-pressed": "0 2px 0 rgba(0,0,0,0.28)",
      },
      fontSize: {
        // scale from DESIGN.md
        display: ["clamp(34px,6vw,60px)", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        growbar: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        risein: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulseglow: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.72" },
        },
      },
      animation: {
        pop: "pop 320ms ease-out",
        growbar: "growbar 420ms ease-out",
        risein: "risein 260ms ease-out both",
        pulseglow: "pulseglow 1.2s ease-in-out infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
