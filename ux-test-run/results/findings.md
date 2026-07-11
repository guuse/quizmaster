# Findings

The app passed every flow. All initial red tests were defects in the **test harness**, not the
app — each was root-caused against the code and a live two-player diagnostic before any change.
No application fix was required.

## Test-harness defects (fixed in specs/helpers)
| # | Symptom | Root cause | Fix | App correct? |
|---|---------|-----------|-----|--------------|
| T1 | `^5$`/difficulty/timer buttons not found | count/difficulty/timer are `role="radio"` segmented controls, not `button` | query `getByRole("radio", …)` | ✅ |
| T2 | After "Generate", `room-code` never appears | creator lands on the room page and confirms a (prefilled) nickname via JoinForm before the lobby — by design (creator plays too) | click through JoinForm in helper | ✅ |
| T3 | H2/B6 timed out waiting for "Correct answer" | reveal is an ephemeral ~1s phase; assertion started polling after the single reveal window closed | arm `waitForSelector('[data-testid=phase-reveal]')` before answering | ✅ |
| T4 | H4 "Play again" never reached lobby | after rematch navigation the creator re-confirms the prefilled nickname (same as T2) | click JoinForm in test | ✅ |
| T5 | B3 duplicate nickname: neither error nor lobby | test read `.isVisible()` immediately, not waiting for the NICK_TAKEN ack round-trip | wait for error-or-lobby | ✅ |

## App behaviour verified (adversarial)
- **Answer-key secrecy (B8):** captured every socket frame a player receives; `correctIndex`
  never appears in `game:question` or any pre-reveal frame. ✅
- **Join lockout after Start (B2):** ROOM_LOCKED, friendly message. ✅
- **Non-existent room (B1):** friendly "code doesn't exist", no crash. ✅
- **Duplicate nickname (B3):** NICK_TAKEN surfaced to the user. ✅
- **Creator-only Start (B4):** joiner has no Start control; stays in lobby. ✅
- **Answer integrity (B7):** after one answer all tiles disable — no change/re-submit via UI. ✅
- **Mid-question refresh (B5):** rehydrates into a live phase (not landing), score preserved. ✅
- **Disconnect resilience (B6):** a player closing their tab does not stall the game; it finishes. ✅
- **Unauth create (B11):** 401. **Out-of-bounds count (B9):** 4xx. ✅
- **Mobile 375px + dark (B12):** no horizontal overflow. ✅
- **Full 2-player game (H2/H3/H5):** both clients agree on final standings; reveal shows correct
  answer + distribution + points; MC and true/false both play. ✅

## Minor UX observations (not bugs — for your consideration)
1. The creator confirms a nickname (prefilled from their Google name) when entering their own
   freshly-created room, and again on "Play again". One extra click each; consistent with the
   "creator plays as a participant" model. Could auto-join the creator to remove the step.
2. `RoomSnapshot` has no `quizId`, so "Play again" falls back to the create screen for a creator
   who joined an existing room by link on a fresh device (no locally-stored quizId). (Flagged by
   the build; add owner-only `quizId` to the snapshot to close it.)
3. No explicit client/server clock-sync channel; the countdown assumes aligned clocks (always
   true single-origin). `useCountdown` already accepts a `clockOffsetMs` if ever needed.
