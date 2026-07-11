# Flows

## Happy
| id | area | steps | expected |
|----|------|-------|----------|
| H1 | create | dev-login → fill topic/count/diff/timer → Generate | lands in lobby with room code |
| H2 | multiplayer | creator lobby + 2nd player joins via /join/:code | both appear in roster |
| H3 | play | Start → answer each Q on both clients (incl. true/false) | reveal→leaderboard→final render; standings agree |
| H4 | replay | Final → Play again | fresh room code, lobby |
| H5 | reveal | after a question | correct answer + distribution + points shown |

## Breaking / adversarial
| id | area | steps | expected (graceful) |
|----|------|-------|---------------------|
| B1 | join | join code `ZZZZZZ` (nonexistent) | friendly error, no crash |
| B2 | join-after-start | player joins /join/:code after Start | locked out with message (ROOM_LOCKED) |
| B3 | dup-nick | 2nd player uses same nickname as an existing player | rejected (NICK_TAKEN) or disambiguated, no crash |
| B4 | authz | non-creator emits game:start | rejected (NOT_CREATOR); no start |
| B5 | reconnect | refresh mid-question | rehydrate same phase, score preserved |
| B6 | disconnect | a player closes tab mid-game | game continues, doesn't wait |
| B7 | answer-integrity | submit twice / after close / for wrong index | only first counts; late ignored |
| B8 | secrecy | inspect all socket frames a player receives | correctIndex NEVER present before reveal |
| B9 | create-validation | topic empty / count out of 5–20 | blocked client and/or 400 server |
| B10 | deep-link | refresh /room/:code as anon with no session | prompted for nickname / rejoin, no white screen |
| B11 | create-authz | POST /api/quizzes with no session | 401, no quiz created |
| B12 | responsive | mobile viewport 375px + dark theme | no overflow, controls reachable |
