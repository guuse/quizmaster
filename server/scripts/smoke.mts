/**
 * Throwaway end-to-end smoke test.
 *
 * Boots the real server in-process (dev-auth + a deterministic fake quiz + a tmp SQLite
 * DB), then drives 3 socket.io-client players through the FULL loop:
 *   dev-login -> create quiz -> join x3 -> start -> answer -> reveal -> leaderboard -> final
 *
 * Asserts:
 *   - the creator is flagged as creator; non-creators cannot start the game
 *   - QuestionView NEVER contains an answer key (no `correctIndex` reaches a player)
 *   - scores are computed server-side (someone finishes with > 0)
 *   - exactly one GameResult row is written
 *   - a reconnecting player reattaches to the same identity + score via playerToken
 *
 * Run:  npm run smoke -w server        (uses QUIZMASTER_FAKE_QUIZ by default here)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { io as ioClient, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  CreateQuizResponse,
  JoinResult,
  LeaderboardEntry,
  QuestionView,
  RevealView,
  ServerToClientEvents,
  SimpleResult,
} from "@quizmaster/shared";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const here = fileURLToPath(new URL(".", import.meta.url));
const schemaPath = join(here, "..", "..", "prisma", "schema.prisma");

async function main(): Promise<void> {
  // 1. Isolated tmp SQLite DB with the schema applied via `prisma migrate deploy`.
  const dbDir = mkdtempSync(join(tmpdir(), "qm-smoke-"));
  const dbUrl = `file:${join(dbDir, "smoke.db")}`;
  process.env.DATABASE_URL = dbUrl;
  execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "ignore",
  });

  // Import AFTER DATABASE_URL is set (PrismaClient reads it at construction).
  const { loadEnv } = await import("../src/env.js");
  const { startServer } = await import("../src/app.js");
  const { getPrisma, disconnectPrisma } = await import("../src/db.js");

  const env = loadEnv({
    port: 0,
    corsOrigin: null,
    devAuth: true,
    fakeQuiz: true, // deterministic loop; real generation is the production default
    revealMs: 200,
    leaderboardMs: 200,
    countdownMs: 50,
    sessionSecret: "smoke-test-secret",
  });

  const server = await startServer(env);
  const base = `http://127.0.0.1:${server.port}`;
  const prisma = getPrisma();
  let failure: unknown = null;

  try {
    // 2. Dev-login as the creator -> session cookie.
    const loginRes = await fetch(`${base}/api/auth/dev-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Smoke Creator" }),
    });
    assert.equal(loginRes.status, 200, "dev-login should succeed");
    const rawCookie = loginRes.headers.get("set-cookie");
    assert.ok(rawCookie, "dev-login should set a session cookie");
    const cookie = rawCookie!.split(";")[0]; // qm_session=...

    // 3. Create + seal a quiz (auth-gated); response carries NO answers.
    const createRes = await fetch(`${base}/api/quizzes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ topic: "Smoke Test", count: 5, difficulty: "easy", timerSeconds: 10 }),
    });
    assert.equal(createRes.status, 201, "quiz creation should succeed");
    const created = (await createRes.json()) as CreateQuizResponse;
    assert.ok(created.roomCode && created.roomCode.length === 6, "room code should be 6 chars");
    assert.equal(created.questionCount, 5);
    assert.ok(!("questions" in created), "create response must not contain questions/answers");
    const roomCode = created.roomCode;
    console.log(`  quiz created -> room ${roomCode}`);

    // 4. Connect 3 clients. The creator carries the session cookie on its handshake.
    const creator = ioClient(base, { extraHeaders: { Cookie: cookie }, forceNew: true });
    const p2 = ioClient(base, { forceNew: true });
    const p3 = ioClient(base, { forceNew: true });
    const clients: ClientSocket[] = [creator, p2, p3];

    // Guard: no player socket may ever receive an answer key.
    for (const c of clients) {
      c.on("game:question", (q: QuestionView) => {
        assert.ok(!("correctIndex" in (q as object)), "QuestionView must not leak correctIndex");
        for (const opt of q.options) assert.equal(typeof opt, "string");
      });
      c.on("room:snapshot", (snap) => {
        if (snap.question) {
          assert.ok(!("correctIndex" in (snap.question as object)), "snapshot.question must not leak correctIndex");
        }
      });
    }

    await Promise.all(clients.map((c) => waitConnect(c)));

    // 5. Join all three. Keep tokens for the reconnection test.
    const joinCreator = await joinRoom(creator, roomCode, "Creator");
    const joinP2 = await joinRoom(p2, roomCode, "Bob");
    const joinP3 = await joinRoom(p3, roomCode, "Cara");
    assert.ok(joinCreator.ok && joinP2.ok && joinP3.ok, "all joins succeed");
    if (!joinCreator.ok || !joinP2.ok || !joinP3.ok) throw new Error("join failed");

    assert.equal(joinCreator.snapshot.you?.isCreator, true, "cookie holder is the creator");
    assert.equal(joinP2.snapshot.you?.isCreator, false, "player 2 is not creator");
    assert.equal(joinCreator.snapshot.phase, "lobby");
    const p3PlayerId = joinP3.snapshot.you!.id;
    console.log("  3 players joined; creator flagged correctly");

    // 6. Non-creator cannot start.
    const badStart = await emitStart(p2);
    assert.equal(badStart.ok, false, "non-creator start must be rejected");
    assert.equal(badStart.code, "NOT_CREATOR");

    // Each client answers each question it sees (closes the question early).
    for (let idx = 0; idx < clients.length; idx++) {
      const c = clients[idx];
      c.on("game:question", (q: QuestionView) => {
        const optionIndex = idx % q.options.length; // valid for both 2- and 4-option questions
        c.emit("answer:submit", { questionIndex: q.index, optionIndex }, () => {});
      });
    }

    // Verify reveal payloads: everyone gets correctIndex + their own earnings.
    creator.on("game:reveal", (r: RevealView) => {
      assert.equal(typeof r.correctIndex, "number", "reveal carries the correct answer");
      assert.ok(r.you, "reveal carries per-player earnings");
      assert.equal(r.distribution.length >= 2, true);
    });

    const finalPromise = waitFinal(creator);

    // 7. Creator starts the game.
    const goodStart = await emitStart(creator);
    assert.equal(goodStart.ok, true, "creator start succeeds");
    console.log("  game started");

    const finalBoard = await finalPromise;
    assert.equal(finalBoard.length, 3, "final leaderboard has all players");
    const maxScore = Math.max(...finalBoard.map((e) => e.score));
    assert.ok(maxScore > 0, "at least one player scored points (server-side scoring works)");
    assert.deepEqual(
      finalBoard.map((e) => e.rank),
      [...finalBoard].map((e) => e.rank),
    );
    assert.equal(finalBoard[0].rank, 1, "top entry is rank 1");
    console.log(`  final reached; top score = ${maxScore}`);

    // 8. Exactly one GameResult row was written for this play-through.
    const results = await prisma.gameResult.findMany({ where: { roomCode } });
    assert.equal(results.length, 1, "exactly one GameResult row");
    assert.equal(results[0].playerCount, 3);
    const standings = JSON.parse(results[0].standingsJson) as LeaderboardEntry[];
    assert.equal(standings.length, 3);
    console.log("  one GameResult row persisted");

    // 9. Reconnection: p3 drops and returns with its playerToken -> same identity + score.
    const p3Score = finalBoard.find((e) => e.playerId === p3PlayerId)?.score ?? -1;
    p3.disconnect();
    await delay(100);
    const p3b = ioClient(base, { forceNew: true });
    await waitConnect(p3b);
    const rejoin = await joinRoom(p3b, roomCode, "Cara", joinP3.playerToken);
    assert.ok(rejoin.ok, "reconnection with token succeeds");
    if (!rejoin.ok) throw new Error("rejoin failed");
    assert.equal(rejoin.snapshot.you?.id, p3PlayerId, "reattached to the same player identity");
    const rejoinedScore = rejoin.snapshot.players.find((pl) => pl.id === p3PlayerId)?.score ?? -1;
    assert.equal(rejoinedScore, p3Score, "score preserved across reconnect");
    assert.equal(rejoin.snapshot.phase, "final", "reconnecting player rehydrates into the live phase");
    console.log(`  reconnection preserved identity + score (${rejoinedScore})`);

    for (const c of [creator, p2, p3b]) c.disconnect();
    console.log("\n✅ SMOKE TEST PASSED");
  } catch (err) {
    failure = err;
  } finally {
    await server.close();
    await disconnectPrisma();
  }

  if (failure) {
    console.error("\n❌ SMOKE TEST FAILED");
    console.error(failure);
    process.exit(1);
  }
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────────────

function waitConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("connect timeout")), 5000);
    socket.on("connect", () => {
      clearTimeout(t);
      resolve();
    });
    socket.on("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function joinRoom(
  socket: ClientSocket,
  roomCode: string,
  nickname: string,
  playerToken?: string,
): Promise<JoinResult> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("join timeout")), 5000);
    socket.emit("room:join", { roomCode, nickname, playerToken }, (res: JoinResult) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function emitStart(socket: ClientSocket): Promise<SimpleResult> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("start timeout")), 5000);
    socket.emit("game:start", (res: SimpleResult) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function waitFinal(socket: ClientSocket): Promise<LeaderboardEntry[]> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("did not reach final in time")), 30000);
    socket.on("game:final", (board: LeaderboardEntry[]) => {
      clearTimeout(t);
      resolve(board);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

void main();
