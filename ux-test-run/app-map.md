# Quizmaster — App Map

## Stack
- Client: React 18 + Vite 5 + TS + Tailwind (SPA, react-router-dom). Dev on :5173, proxies `/api` + `/socket.io` to :3000.
- Server: Node 20 + Express + Socket.IO + Prisma (SQLite). :3000.
- Contract: `@quizmaster/shared` (quiz schema, socket events, scoring).

## Run (test config)
1. `DATABASE_URL="file:./dev.db" npx prisma migrate deploy --schema prisma/schema.prisma`
2. Backend: `DATABASE_URL="file:./dev.db" QUIZMASTER_DEV_AUTH=1 QUIZMASTER_FAKE_QUIZ=1 npm run dev -w server`
3. Client: `npm run dev -w client`

## Auth
- Dev-login (QUIZMASTER_DEV_AUTH=1): landing "Dev login" affordance, or `POST /api/auth/dev-login {name}` → session cookie.
- Anonymous players join via `/join/:code` (no login).

## Screens / routes
| Route | Screen | Auth | Notes |
|-------|--------|------|-------|
| `/` | Landing/Create | login to create; anon can enter a join code | topic, count(5–20), difficulty, timer(10/20/30) |
| (in-flight) | Generating | creator | shimmer during POST /api/quizzes |
| `/room/:code` `/join/:code` | Lobby→Question→Reveal→Leaderboard→Final | player | snapshot-driven phase machine |

## Interactive surfaces
- Create form (topic textarea, 3 segmented controls, Generate).
- Join form (nickname, code).
- Lobby (copy link, player list, creator-only Start).
- Question (countdown, 4-tile grid / 2-tile T/F, answer lock).
- Reveal / Leaderboard / Final (Play again, Home).

## Key invariants to attack
- Players never receive `correctIndex` over the wire.
- Correctness not shown before reveal phase.
- No answer change / late / double submit.
- Join locked after Start; non-existent code handled; dup nickname handled; non-creator can't Start.
- Mid-question refresh rehydrates same phase, score preserved.
- Disconnect doesn't stall the game.
