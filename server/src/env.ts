/**
 * Central runtime configuration. Everything the server needs from the environment
 * is read (and lightly validated) here, so no other module touches `process.env`.
 *
 * `loadEnv()` returns a frozen config object. Tests (the smoke script) can override
 * individual values by passing them in — this keeps the game loop fully driveable
 * without real Google/Anthropic credentials.
 */
import { readFileSync } from "node:fs";

export interface Env {
  port: number;
  /** Where the client SPA build lives (client/dist), served as static files. */
  clientDist: string;
  /** Allowed CORS origin for the dev Vite client (dev only). */
  corsOrigin: string | null;
  sessionSecret: string;

  // Anthropic — real generation is the default.
  anthropicApiKey: string | null;
  /** OAuth-style bearer token (sk-ant-oat01-...). Used via Authorization: Bearer. */
  anthropicAuthToken: string | null;
  quizModel: string;

  // Google OAuth (creators). When unset, the Google routes report "not configured".
  googleClientId: string | null;
  googleClientSecret: string | null;
  oauthRedirectUri: string | null;

  // Test / local switches.
  devAuth: boolean; // QUIZMASTER_DEV_AUTH=1 enables POST /api/auth/dev-login
  fakeQuiz: boolean; // QUIZMASTER_FAKE_QUIZ=1 returns a deterministic quiz (no Claude call)

  // Phase durations (ms). Overridable so tests can run the loop fast.
  revealMs: number;
  leaderboardMs: number;

  isProduction: boolean;
}

export function loadEnv(overrides: Partial<Env> = {}): Env {
  loadDotenvOnce();
  const env: Env = {
    port: Number(process.env.PORT ?? 3000),
    clientDist: process.env.CLIENT_DIST ?? defaultClientDist(),
    corsOrigin: process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === "production" ? null : "http://localhost:5173"),
    sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me",

    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
    // Accept a Claude Code / OAuth token from either of these names.
    anthropicAuthToken: process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.CLAUDE_SDK_TOKEN ?? null,
    // Default to the bare "claude-sonnet-5" alias on purpose: it auto-tracks the newest
    // Sonnet 5 snapshot, so we never bump it for snapshot releases. Do NOT pin a dated
    // snapshot (e.g. claude-sonnet-5-20xxxxxx). QUIZ_MODEL can override per-deploy (e.g. to
    // claude-haiku-4-5-20251001 for more rate-limit headroom on a subscription token).
    quizModel: process.env.QUIZ_MODEL ?? "claude-sonnet-5",

    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    oauthRedirectUri: process.env.OAUTH_REDIRECT_URI ?? null,

    devAuth: process.env.QUIZMASTER_DEV_AUTH === "1",
    fakeQuiz: process.env.QUIZMASTER_FAKE_QUIZ === "1",

    revealMs: Number(process.env.QUIZMASTER_REVEAL_MS ?? 5000),
    leaderboardMs: Number(process.env.QUIZMASTER_LEADERBOARD_MS ?? 5000),

    isProduction: process.env.NODE_ENV === "production",
    ...overrides,
  };
  return Object.freeze(env);
}

function defaultClientDist(): string {
  // dist/env.js -> ../../client/dist  (server/dist/env.js at runtime; server/src/env.ts at dev)
  return new URL("../../client/dist", import.meta.url).pathname;
}

/**
 * Minimal .env loader (no dependency). In production the environment comes from the
 * container/Secret, so there is no .env file and this is a no-op. In local dev it lets
 * ANTHROPIC_API_KEY / CLAUDE_SDK_TOKEN / GOOGLE_* be read from the repo-root .env.
 * Never overrides a value already present in the real environment.
 */
let dotenvLoaded = false;
function loadDotenvOnce(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  const candidates = [
    `${process.cwd()}/.env`,
    `${process.cwd()}/../.env`,
    new URL("../../.env", import.meta.url).pathname, // repo root from server/dist
    new URL("../../../.env", import.meta.url).pathname,
  ];
  for (const path of candidates) {
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
    return; // first file found wins
  }
}
