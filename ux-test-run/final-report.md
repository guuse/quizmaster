# Quizmaster — UX Test Final Report

**Result: 14/14 flows green. No application bugs found.**

## Scope
Two concurrent browser contexts (creator via dev-login + anonymous joiner via `/join/:code`),
driving the full game and 12 adversarial cases against the real client+server over Socket.IO.

## Suite
| Area | Tests | Status |
|------|-------|--------|
| Happy — create, full 2-player game, reveal content, play-again | H1, H2/H3/H5, H4 | ✅ |
| Secrecy — no answer key over the wire | B8 | ✅ |
| Join edge cases — bad code, lockout, dup nickname | B1, B2, B3 | ✅ |
| Authz — creator-only start, unauth create | B4, B11 | ✅ |
| Game integrity — answer lock, validation | B7, B9 | ✅ |
| Resilience — mid-question refresh, mid-game disconnect | B5, B6 | ✅ |
| Responsive — mobile + dark, no overflow | B12 | ✅ |

## Bugs found & fixed
None in the app. Five test-harness defects (wrong selectors / ephemeral-state races / missing
waits) were found and fixed in the specs — see `results/findings.md`. Each was verified against
the source and a live diagnostic to confirm the app was already correct.

## Needs-human
Nothing blocking. Three minor UX observations (creator nickname re-confirm; `quizId` absent from
`RoomSnapshot` for cross-device replay; no clock-sync channel) are documented in `findings.md` as
optional polish — not defects.

## How to reproduce
```
DATABASE_URL="file:./dev.db" npx prisma migrate deploy --schema prisma/schema.prisma
DATABASE_URL="file:./dev.db" QUIZMASTER_DEV_AUTH=1 QUIZMASTER_FAKE_QUIZ=1 QUIZMASTER_REVEAL_MS=900 QUIZMASTER_LEADERBOARD_MS=900 npm run dev -w server
npm run dev -w client
cd ux-test-run && npx playwright test --config=playwright.config.ts
```
