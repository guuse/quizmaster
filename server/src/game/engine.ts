/**
 * The server-authoritative game engine — the heart of Quizmaster.
 *
 * Holds Map<roomCode, Room> and runs the phase loop entirely server-side:
 *   lobby -> question -> reveal(~5s) -> leaderboard(~5s) -> (next | final)
 *
 * Timers are server-authoritative (questionStartedAt / questionEndsAt are epoch ms).
 * A question closes on its timer OR when every connected player has answered. The game
 * never waits on a disconnected player. Answers (correctIndex, per-player earned) are
 * computed here and only ever leave via the reveal, with the correct answer revealed
 * to everyone but per-player earnings sent per-recipient. correctIndex is NEVER sent
 * during the question phase.
 */
import type {
  ErrorResult,
  JoinResult,
  LeaderboardEntry,
  PlayerView,
  Question,
  QuestionView,
  RevealOption,
  RevealView,
  RoomSnapshot,
  SimpleResult,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@quizmaster/shared";
import { computeScore } from "@quizmaster/shared";
import type { Server, Socket } from "socket.io";
import type { PrismaClient } from "@prisma/client";
import { generateRoomCode, generateToken } from "./codes.js";
import type { AnswerRecord, PlayerState, Room } from "./state.js";

export const REVEAL_MS = 5000;
export const LEADERBOARD_MS = 5000;
export const COUNTDOWN_MS = 3000; // "3-2-1" before every question
const REAP_AFTER_MS = 2 * 60 * 1000; // 2 minutes with no connected players
const REAP_INTERVAL_MS = 30 * 1000;

export interface EngineOptions {
  revealMs?: number;
  leaderboardMs?: number;
  countdownMs?: number;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class GameEngine {
  private rooms = new Map<string, Room>();
  /** socket.id -> { code, playerId } so a disconnect can find its player. */
  private socketIndex = new Map<string, { code: string; playerId: string }>();
  private reaper: NodeJS.Timeout;
  private revealMs: number;
  private leaderboardMs: number;
  private countdownMs: number;

  constructor(
    private io: IO,
    private prisma: PrismaClient,
    options: EngineOptions = {},
  ) {
    this.revealMs = options.revealMs ?? REVEAL_MS;
    this.leaderboardMs = options.leaderboardMs ?? LEADERBOARD_MS;
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
    this.reaper = setInterval(() => this.reapRooms(), REAP_INTERVAL_MS);
    // Don't keep the process alive just for the reaper.
    this.reaper.unref?.();
  }

  stop(): void {
    clearInterval(this.reaper);
    for (const room of this.rooms.values()) {
      if (room.timer) clearTimeout(room.timer);
    }
    this.rooms.clear();
  }

  // ── Room lifecycle ──────────────────────────────────────────────────────────

  createRoom(input: {
    quizId: string;
    topic: string;
    ownerUserId: string;
    timerSeconds: number;
    questions: Question[];
  }): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const room: Room = {
      code,
      quizId: input.quizId,
      topic: input.topic,
      ownerUserId: input.ownerUserId,
      timerSeconds: input.timerSeconds,
      questions: input.questions,
      phase: "lobby",
      players: new Map(),
      creatorPlayerId: null,
      currentQuestionIndex: -1,
      questionStartedAt: 0,
      questionEndsAt: 0,
      countdownEndsAt: 0,
      countdownNextIndex: -1,
      finalWritten: false,
      emptySince: Date.now(),
      timer: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code.toUpperCase());
  }

  /** Pre-check for a re-arm: does this room exist and is `userId` its creator? */
  roomOwnership(code: string, userId: string): "ok" | "not_found" | "not_creator" {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return "not_found";
    if (room.ownerUserId !== userId) return "not_creator";
    return "ok";
  }

  /**
   * Re-arm an existing room with a freshly generated quiz: keep the players (and the creator),
   * reset scores/answers, and return everyone to the lobby. Powers "host makes a new quiz and
   * everyone plays again in the same room". Ownership must be validated first (roomOwnership).
   */
  rearmRoom(
    code: string,
    input: { quizId: string; topic: string; timerSeconds: number; questions: Question[] },
  ): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    this.clearTimer(room);
    room.quizId = input.quizId;
    room.topic = input.topic;
    room.timerSeconds = input.timerSeconds;
    room.questions = input.questions;
    room.phase = "lobby";
    room.currentQuestionIndex = -1;
    room.questionStartedAt = 0;
    room.questionEndsAt = 0;
    room.countdownEndsAt = 0;
    room.countdownNextIndex = -1;
    room.finalWritten = false;
    for (const p of room.players.values()) {
      p.score = 0;
      p.answers.clear();
    }
    // Flip everyone still connected from the final screen back to the fresh lobby.
    this.pushSnapshots(room);
    this.broadcastPlayers(room);
  }

  // ── Socket event handlers ─────────────────────────────────────────────────────

  /**
   * Join a room. `userId` (resolved from the socket's session cookie, may be null)
   * identifies whether this connection is the quiz's creator. `playerToken` reattaches
   * a returning player to their existing identity + score.
   */
  handleJoin(
    socket: GameSocket,
    payload: { roomCode: string; nickname: string; playerToken?: string },
    userId: string | null,
    ack: (res: JoinResult) => void,
  ): void {
    const code = (payload.roomCode ?? "").toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      ack({ ok: false, code: "ROOM_NOT_FOUND", message: "That room code doesn't exist." });
      return;
    }

    const nickname = (payload.nickname ?? "").trim();

    // Reconnection: a valid token reattaches to the same player (allowed mid-game).
    if (payload.playerToken) {
      const existing = this.findPlayerByToken(room, payload.playerToken);
      if (existing) {
        this.attachSocket(socket, room, existing);
        // Allow a nickname update only while still in the lobby.
        if (room.phase === "lobby" && nickname && nickname !== existing.nickname) {
          if (!this.nicknameTaken(room, nickname, existing.id)) existing.nickname = nickname;
        }
        this.completeJoin(socket, room, existing, ack);
        return;
      }
      // Token unknown (e.g. reaped room). Fall through to a fresh join if allowed.
    }

    // Fresh join is only allowed in the lobby — the room locks at start.
    if (room.phase !== "lobby") {
      ack({ ok: false, code: "ROOM_LOCKED", message: "This game has already started." });
      return;
    }
    if (!nickname) {
      ack({ ok: false, code: "BAD_STATE", message: "Please choose a nickname." });
      return;
    }
    if (this.nicknameTaken(room, nickname, null)) {
      ack({ ok: false, code: "NICK_TAKEN", message: "That nickname is taken." });
      return;
    }

    const isCreator = userId !== null && userId === room.ownerUserId && room.creatorPlayerId === null;
    const player: PlayerState = {
      id: generateToken(16),
      token: generateToken(24),
      nickname,
      score: 0,
      isCreator,
      connected: true,
      socketId: socket.id,
      answers: new Map(),
    };
    room.players.set(player.id, player);
    if (isCreator) room.creatorPlayerId = player.id;
    room.emptySince = null;

    this.socketIndex.set(socket.id, { code: room.code, playerId: player.id });
    socket.join(room.code);

    this.completeJoin(socket, room, player, ack);
  }

  /** Ack a successful join (token + snapshot) and refresh the roster for everyone. */
  private completeJoin(
    socket: GameSocket,
    room: Room,
    player: PlayerState,
    ack: (res: JoinResult) => void,
  ): void {
    const snapshot = this.buildSnapshot(room, player);
    ack({ ok: true, playerToken: player.token, snapshot });
    // Also emit a snapshot so a client that ignores the ack still rehydrates.
    this.io.to(socket.id).emit("room:snapshot", snapshot);
    this.broadcastPlayers(room);
  }

  /** Creator-only: lock the lobby and start the game. */
  handleStart(socket: GameSocket, ack: (res: SimpleResult) => void): void {
    const ref = this.socketIndex.get(socket.id);
    const room = ref ? this.rooms.get(ref.code) : undefined;
    if (!room || !ref) {
      ack({ ok: false, code: "ROOM_NOT_FOUND", message: "You are not in a room." });
      return;
    }
    const player = room.players.get(ref.playerId);
    if (!player || !player.isCreator) {
      ack({ ok: false, code: "NOT_CREATOR", message: "Only the creator can start the game." });
      return;
    }
    if (room.phase !== "lobby") {
      ack({ ok: false, code: "BAD_STATE", message: "The game has already started." });
      return;
    }
    ack({ ok: true });
    this.startCountdown(room, 0);
  }

  /** Submit an answer for the active question. Late/duplicate answers are ignored. */
  handleAnswer(
    socket: GameSocket,
    payload: { questionIndex: number; optionIndex: number },
    ack: (res: SimpleResult) => void,
  ): void {
    const ref = this.socketIndex.get(socket.id);
    const room = ref ? this.rooms.get(ref.code) : undefined;
    if (!room || !ref) {
      ack({ ok: false, code: "ROOM_NOT_FOUND", message: "You are not in a room." });
      return;
    }
    const player = room.players.get(ref.playerId);
    if (!player) {
      ack({ ok: false, code: "BAD_STATE", message: "Unknown player." });
      return;
    }
    if (room.phase !== "question" || payload.questionIndex !== room.currentQuestionIndex) {
      ack({ ok: false, code: "BAD_STATE", message: "No active question for that index." });
      return;
    }
    if (player.answers.has(room.currentQuestionIndex)) {
      ack({ ok: false, code: "BAD_STATE", message: "You already answered." });
      return;
    }
    const question = room.questions[room.currentQuestionIndex];
    if (payload.optionIndex < 0 || payload.optionIndex >= question.options.length) {
      ack({ ok: false, code: "BAD_STATE", message: "Invalid option." });
      return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, Math.min(now - room.questionStartedAt, room.timerSeconds * 1000));
    const correct = payload.optionIndex === question.correctIndex;
    const earned = computeScore(correct, elapsedMs, room.timerSeconds);
    const record: AnswerRecord = { optionIndex: payload.optionIndex, elapsedMs, earned, correct };
    player.answers.set(room.currentQuestionIndex, record);
    player.score += earned;

    ack({ ok: true });

    // Close early if every connected player has now answered.
    if (this.allConnectedAnswered(room)) {
      this.closeQuestion(room);
    }
  }

  /** Re-send the current snapshot (e.g. after a transport reconnect). */
  handleResync(
    socket: GameSocket,
    ack: (res: { snapshot: RoomSnapshot } | ErrorResult) => void,
  ): void {
    const ref = this.socketIndex.get(socket.id);
    const room = ref ? this.rooms.get(ref.code) : undefined;
    if (!room || !ref) {
      ack({ ok: false, code: "ROOM_NOT_FOUND", message: "You are not in a room." });
      return;
    }
    const player = room.players.get(ref.playerId);
    if (!player) {
      ack({ ok: false, code: "BAD_STATE", message: "Unknown player." });
      return;
    }
    ack({ snapshot: this.buildSnapshot(room, player) });
  }

  handleDisconnect(socket: GameSocket): void {
    const ref = this.socketIndex.get(socket.id);
    if (!ref) return;
    this.socketIndex.delete(socket.id);
    const room = this.rooms.get(ref.code);
    if (!room) return;
    const player = room.players.get(ref.playerId);
    if (!player) return;
    if (player.socketId === socket.id) {
      player.connected = false;
      player.socketId = null;
    }
    if (this.connectedCount(room) === 0) {
      room.emptySince = Date.now();
    }
    this.broadcastPlayers(room);
    // A disconnect can be the event that means "everyone remaining has answered".
    if (room.phase === "question" && this.allConnectedAnswered(room)) {
      this.closeQuestion(room);
    }
  }

  // ── Phase loop ────────────────────────────────────────────────────────────────

  /** Brief "3-2-1" before a question opens (server-timed, synchronized for everyone). */
  private startCountdown(room: Room, nextIndex: number): void {
    this.clearTimer(room);
    room.phase = "countdown";
    room.countdownNextIndex = nextIndex;
    room.countdownEndsAt = Date.now() + this.countdownMs;
    this.pushSnapshots(room);
    room.timer = setTimeout(() => this.openQuestion(room, nextIndex), this.countdownMs);
  }

  private openQuestion(room: Room, index: number): void {
    room.phase = "question";
    room.currentQuestionIndex = index;
    room.questionStartedAt = Date.now();
    room.questionEndsAt = room.questionStartedAt + room.timerSeconds * 1000;

    const view = this.buildQuestionView(room, index);
    this.io.to(room.code).emit("game:question", view);
    this.pushSnapshots(room);

    this.clearTimer(room);
    room.timer = setTimeout(() => this.closeQuestion(room), room.timerSeconds * 1000);

    // Edge case: no connected players at all -> close immediately on the timer only.
    if (this.connectedCount(room) > 0 && this.allConnectedAnswered(room)) {
      this.closeQuestion(room);
    }
  }

  private closeQuestion(room: Room): void {
    if (room.phase !== "question") return;
    this.clearTimer(room);
    room.phase = "reveal";

    const question = room.questions[room.currentQuestionIndex];
    const distribution = this.buildDistribution(room, question);

    // Per-recipient reveal: everyone gets the correct answer + distribution, but the
    // `you` earnings are personal.
    for (const player of room.players.values()) {
      if (!player.connected || !player.socketId) continue;
      const reveal = this.buildReveal(room, player, question, distribution);
      this.io.to(player.socketId).emit("game:reveal", reveal);
    }
    this.pushSnapshots(room);

    this.clearTimer(room);
    room.timer = setTimeout(() => this.showLeaderboard(room), this.revealMs);
  }

  private showLeaderboard(room: Room): void {
    room.phase = "leaderboard";
    const leaderboard = this.buildLeaderboard(room);
    this.io.to(room.code).emit("game:leaderboard", leaderboard);
    this.pushSnapshots(room);

    this.clearTimer(room);
    const isLast = room.currentQuestionIndex >= room.questions.length - 1;
    room.timer = setTimeout(() => {
      if (isLast) {
        void this.finish(room);
      } else {
        this.startCountdown(room, room.currentQuestionIndex + 1);
      }
    }, this.leaderboardMs);
  }

  private async finish(room: Room): Promise<void> {
    room.phase = "final";
    const leaderboard = this.buildLeaderboard(room);
    this.io.to(room.code).emit("game:final", leaderboard);
    this.pushSnapshots(room);
    this.clearTimer(room);

    // Write exactly ONE GameResult row for this play-through.
    if (!room.finalWritten) {
      room.finalWritten = true;
      const standings = leaderboard.map((e) => ({ nickname: e.nickname, score: e.score, rank: e.rank }));
      try {
        await this.prisma.gameResult.create({
          data: {
            quizId: room.quizId,
            roomCode: room.code,
            playerCount: room.players.size,
            standingsJson: JSON.stringify(standings),
          },
        });
      } catch (err) {
        // Don't let a persistence hiccup crash the process; the game is already over.
        console.error("[game] failed to write GameResult:", err instanceof Error ? err.message : err);
      }
    }
  }

  // ── View builders (answers stripped for players) ────────────────────────────────

  private buildQuestionView(room: Room, index: number): QuestionView {
    const q = room.questions[index];
    return {
      index,
      total: room.questions.length,
      type: q.type,
      text: q.text,
      options: q.options, // NOTE: no correctIndex — never sent to players.
      timerSeconds: room.timerSeconds,
      questionStartedAt: room.questionStartedAt,
      questionEndsAt: room.questionEndsAt,
    };
  }

  private buildDistribution(room: Room, question: Question): RevealOption[] {
    const chosen: { id: string; nickname: string }[][] = question.options.map(() => []);
    for (const player of room.players.values()) {
      const ans = player.answers.get(room.currentQuestionIndex);
      if (ans && ans.optionIndex >= 0 && ans.optionIndex < chosen.length) {
        chosen[ans.optionIndex].push({ id: player.id, nickname: player.nickname });
      }
    }
    return question.options.map((text, index) => ({
      index,
      text,
      count: chosen[index].length,
      isCorrect: index === question.correctIndex,
      players: chosen[index],
    }));
  }

  private buildReveal(
    room: Room,
    player: PlayerState,
    question: Question,
    distribution: RevealOption[],
  ): RevealView {
    const ans = player.answers.get(room.currentQuestionIndex);
    return {
      questionIndex: room.currentQuestionIndex,
      correctIndex: question.correctIndex,
      distribution,
      you: ans
        ? { earned: ans.earned, total: player.score, wasCorrect: ans.correct, chosenIndex: ans.optionIndex }
        : { earned: 0, total: player.score, wasCorrect: false, chosenIndex: null },
    };
  }

  private buildLeaderboard(room: Room): LeaderboardEntry[] {
    const sorted = [...room.players.values()].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.nickname.localeCompare(b.nickname);
    });
    const entries: LeaderboardEntry[] = [];
    let rank = 0;
    let prevScore: number | null = null;
    sorted.forEach((p, i) => {
      // Ties share a rank (competition ranking).
      if (prevScore === null || p.score !== prevScore) {
        rank = i + 1;
        prevScore = p.score;
      }
      entries.push({ playerId: p.id, nickname: p.nickname, score: p.score, rank });
    });
    return entries;
  }

  private buildPlayerViews(room: Room): PlayerView[] {
    return [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      connected: p.connected,
      isCreator: p.isCreator,
    }));
  }

  buildSnapshot(room: Room, player: PlayerState): RoomSnapshot {
    const phase = room.phase;
    const question =
      phase === "question" ? this.buildQuestionView(room, room.currentQuestionIndex) : null;

    let reveal: RevealView | null = null;
    if (phase === "reveal") {
      const q = room.questions[room.currentQuestionIndex];
      reveal = this.buildReveal(room, player, q, this.buildDistribution(room, q));
    }

    const leaderboard =
      phase === "leaderboard" || phase === "final" ? this.buildLeaderboard(room) : null;

    const countdown =
      phase === "countdown"
        ? {
            endsAt: room.countdownEndsAt,
            questionNumber: room.countdownNextIndex + 1,
            total: room.questions.length,
          }
        : null;

    const youAnswered =
      phase === "question" ? player.answers.has(room.currentQuestionIndex) : false;

    return {
      roomCode: room.code,
      quizTopic: room.topic,
      phase,
      players: this.buildPlayerViews(room),
      you: { id: player.id, nickname: player.nickname, isCreator: player.isCreator },
      question,
      reveal,
      leaderboard,
      countdown,
      serverNow: Date.now(),
      youAnswered,
    };
  }

  // ── Emit helpers ────────────────────────────────────────────────────────────────

  /** Push a fresh per-player snapshot to every connected player (phase change / rehydrate). */
  private pushSnapshots(room: Room): void {
    for (const player of room.players.values()) {
      if (player.connected && player.socketId) {
        this.io.to(player.socketId).emit("room:snapshot", this.buildSnapshot(room, player));
      }
    }
  }

  private broadcastPlayers(room: Room): void {
    this.io.to(room.code).emit("room:players", this.buildPlayerViews(room));
  }

  private attachSocket(socket: GameSocket, room: Room, player: PlayerState): void {
    // If another socket held this player, leave it dangling (last write wins).
    player.connected = true;
    player.socketId = socket.id;
    room.emptySince = null;
    this.socketIndex.set(socket.id, { code: room.code, playerId: player.id });
    socket.join(room.code);
  }

  // ── Internal utilities ──────────────────────────────────────────────────────────

  private findPlayerByToken(room: Room, token: string): PlayerState | null {
    for (const p of room.players.values()) if (p.token === token) return p;
    return null;
  }

  private nicknameTaken(room: Room, nickname: string, exceptPlayerId: string | null): boolean {
    const lower = nickname.toLowerCase();
    for (const p of room.players.values()) {
      if (p.id === exceptPlayerId) continue;
      if (p.nickname.toLowerCase() === lower) return true;
    }
    return false;
  }

  private connectedCount(room: Room): number {
    let n = 0;
    for (const p of room.players.values()) if (p.connected) n++;
    return n;
  }

  private allConnectedAnswered(room: Room): boolean {
    let connectedPlayers = 0;
    for (const p of room.players.values()) {
      if (!p.connected) continue;
      connectedPlayers++;
      if (!p.answers.has(room.currentQuestionIndex)) return false;
    }
    return connectedPlayers > 0;
  }

  private clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
  }

  private reapRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.emptySince !== null && now - room.emptySince > REAP_AFTER_MS) {
        this.clearTimer(room);
        this.rooms.delete(code);
      }
    }
  }

  // Exposed for the join-ack wiring in socket.ts.
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }
  getPlayerBySocket(socketId: string): { room: Room; player: PlayerState } | null {
    const ref = this.socketIndex.get(socketId);
    if (!ref) return null;
    const room = this.rooms.get(ref.code);
    if (!room) return null;
    const player = room.players.get(ref.playerId);
    if (!player) return null;
    return { room, player };
  }
}
