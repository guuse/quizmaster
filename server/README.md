# Quizmaster — Server

Node 20 + TypeScript (ESM) backend: Express + Socket.IO + Prisma (SQLite) + the Anthropic
SDK. It generates quizzes with Claude, runs the server-authoritative live game loop in
memory, and serves the built client SPA. See `../CONTEXT.md` for the design decisions and
`../shared/src/index.ts` for the locked client/server contract.

## Architecture

- **`src/app.ts`** — assembles Express + Socket.IO on one HTTP server, serves `client/dist`
  with an SPA fallback (so `/join/:code` survives a refresh), opens dev CORS for Vite.
- **`src/auth/`** — Google OAuth + session cookie (`sessions` table) + dev-login.
- **`src/quiz/`** — `POST /api/quizzes`: validate, call Claude (`claude-sonnet-5`) with a
  forced `submit_quiz` tool call, validate server-side, retry once, persist, open a room.
- **`src/game/`** — the in-memory engine: `Map<roomCode, Room>`, the phase loop
  (lobby → question → reveal → leaderboard → … → final), server-authoritative timers,
  reconnection via `playerToken`, and a reaper for empty rooms.

Answers (`correctIndex`) live only server-side and are **never** serialized to a player
during the question phase — only the reveal exposes the correct answer.

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | for real generation | Anthropic API key. If unset, `CLAUDE_SDK_TOKEN` / `ANTHROPIC_AUTH_TOKEN` is used as an OAuth bearer token instead. Never logged. |
| `CLAUDE_SDK_TOKEN` / `ANTHROPIC_AUTH_TOKEN` | alt to the above | OAuth-style token (`sk-ant-oat01-…`); sent as `Authorization: Bearer` + the oauth beta header. |
| `QUIZ_MODEL` | no | Override the generation model (default `claude-sonnet-5`). |
| `DATABASE_URL` | yes | SQLite URL, e.g. `file:/data/quizmaster.db` (or `file:./dev.db` locally). |
| `SESSION_SECRET` | prod | Session secret (a dev default is used if unset). |
| `GOOGLE_CLIENT_ID` | for Google login | OAuth client id. If unset, the Google routes return a clear "not configured" error. |
| `GOOGLE_CLIENT_SECRET` | for Google login | OAuth client secret. |
| `OAUTH_REDIRECT_URI` | for Google login | Registered callback, e.g. `https://…/api/auth/google/callback`. |
| `QUIZMASTER_DEV_AUTH` | no | `1` enables `POST /api/auth/dev-login` (throwaway creator). **Disabled unless exactly `1`.** |
| `QUIZMASTER_FAKE_QUIZ` | no | `1` returns a deterministic quiz instead of calling Claude (for testing). Real generation is the default. |
| `PORT` | no | HTTP port (default `3000`; `0` = random, used by the smoke test). |
| `CORS_ORIGIN` | no | Dev CORS origin (default `http://localhost:5173`; `null`/unset in production). |
| `CLIENT_DIST` | no | Path to the client build (default `../client/dist`). |
| `QUIZMASTER_REVEAL_MS` / `QUIZMASTER_LEADERBOARD_MS` | no | Phase durations in ms (default `5000` each; the smoke test shortens them). |

Locally, a repo-root `.env` is auto-loaded (values already in the real environment win).
In production the environment comes from the Kubernetes Secret `quizmaster-secrets`.

## HTTP + Socket endpoints

- `GET  /api/health` — liveness/readiness.
- `GET  /api/me` — `MeResponse`.
- `GET  /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/logout`.
- `POST /api/auth/dev-login` — dev only (`QUIZMASTER_DEV_AUTH=1`).
- `POST /api/quizzes` — generate + seal (auth-gated) → `CreateQuizResponse` (no answers).
- `POST /api/quizzes/:id/play` — open a fresh room for a saved quiz (replay).
- `GET  /api/quizzes/:id/results` — `GameResultSummary[]` (owner only).
- Socket.IO events are exactly the `ClientToServerEvents` / `ServerToClientEvents` from
  `@quizmaster/shared`.

## Running in dev

```bash
# From the repo root, once (links workspaces, generates the Prisma client):
npm install

# Create the local SQLite DB from migrations:
DATABASE_URL="file:./dev.db" npx prisma migrate deploy --schema prisma/schema.prisma

# Run the server (tsx watch). The Vite client runs separately on :5173.
DATABASE_URL="file:./dev.db" QUIZMASTER_DEV_AUTH=1 npm run dev -w server
```

With `QUIZMASTER_DEV_AUTH=1` you can create a creator session without Google:

```bash
curl -c cookies.txt -XPOST localhost:3000/api/auth/dev-login \
  -H 'content-type: application/json' -d '{"name":"Me"}'
curl -b cookies.txt -XPOST localhost:3000/api/quizzes \
  -H 'content-type: application/json' \
  -d '{"topic":"Space","count":5,"difficulty":"easy","timerSeconds":20}'
```

Add `QUIZMASTER_FAKE_QUIZ=1` to skip the Claude call during local UI work.

## Smoke test

`scripts/smoke.mts` boots the server in-process (dev-auth, a tmp SQLite DB, a deterministic
fake quiz) and drives 3 socket.io-client players through the full loop, asserting that
scores are computed, answers never leak to players, exactly one `GameResult` row is written,
and a reconnecting player reattaches to the same identity + score.

```bash
npm run build -w server   # build shared + server first
npm run smoke -w server
```

Expected tail:

```
  quiz created -> room ......
  3 players joined; creator flagged correctly
  game started
  final reached; top score = ...
  one GameResult row persisted
  reconnection preserved identity + score (...)

✅ SMOKE TEST PASSED
```

## Build

```bash
npm run build -w server   # prisma generate + tsc -> server/dist
node server/dist/index.js # production start (expects DATABASE_URL)
```

## Deploy

Multi-stage `../Dockerfile` builds shared → client → server and runs
`node server/dist/index.js` after `prisma migrate deploy`. Kubernetes manifests are in
`../deploy/` (Kustomize): `replicas:1` + `Recreate`, a `local-path` PVC at `/data`, a
`Service`, and an `Ingress` for `quizmaster.guuse.online`. `ghcr.io/guuse/quizmaster` is
built by `.github/workflows/build-images.yml` on push to `main`.
