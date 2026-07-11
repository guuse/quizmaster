/**
 * @quizmaster/shared — the single source of truth for the client/server contract.
 *
 * Both the React client and the Node server import from this package. A change here is
 * a compile error on both sides, which is exactly the point: the socket protocol and the
 * quiz schema cannot silently drift apart.
 *
 * See CONTEXT.md for the design decisions these types encode.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Quiz domain
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionType = "multiple_choice" | "true_false";
export type Difficulty = "easy" | "medium" | "hard";

/** A single question. Answers (correctIndex) live only server-side — never sent to players. */
export interface Question {
  type: QuestionType;
  text: string;
  /** 4 options for multiple_choice, 2 (["True","False"]) for true_false. */
  options: string[];
  /** Index into `options`. SERVER-ONLY — must never be serialized to a player. */
  correctIndex: number;
}

/** A generated, sealed quiz. Owned by a creator (user). */
export interface Quiz {
  id: string;
  ownerId: string;
  topic: string;
  difficulty: Difficulty;
  /** Per-question time limit in seconds: 10 | 20 | 30. */
  timerSeconds: 10 | 20 | 30;
  questions: Question[];
  createdAt: string; // ISO
}

/** What Claude must return via the `submit_quiz` tool. Validated server-side before persist. */
export interface GeneratedQuiz {
  questions: Question[];
}

// Generation bounds (also enforced server-side).
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 20;
export const ALLOWED_TIMERS = [10, 20, 30] as const;
export const ALLOWED_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

// ─────────────────────────────────────────────────────────────────────────────
// Scoring — speed-scaled, computed SERVER-SIDE from the received-answer timestamp.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_POINTS = 1000;

/**
 * Kahoot-style: correct + instant ≈ 1000, correct at the buzzer ≈ 500, wrong = 0.
 * `elapsedMs` is measured by the server (question-open → answer-received).
 */
export function computeScore(
  correct: boolean,
  elapsedMs: number,
  timerSeconds: number,
): number {
  if (!correct) return 0;
  const frac = Math.min(1, Math.max(0, elapsedMs / (timerSeconds * 1000)));
  return Math.round(MAX_POINTS * (1 - frac / 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Game phases & view models (server → client, answers stripped)
// ─────────────────────────────────────────────────────────────────────────────

export type GamePhase =
  | "lobby"
  | "question"
  | "reveal"
  | "leaderboard"
  | "final";

/** A player as seen by everyone. No secrets. */
export interface PlayerView {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isCreator: boolean;
}

/** The question as a PLAYER sees it — note: no correctIndex. */
export interface QuestionView {
  index: number; // 0-based
  total: number;
  type: QuestionType;
  text: string;
  options: string[];
  timerSeconds: number;
  /** Server epoch ms when the question opened; client derives the countdown from this. */
  questionStartedAt: number;
  /** Server epoch ms when the question will auto-close. */
  questionEndsAt: number;
}

export interface RevealOption {
  index: number;
  text: string;
  count: number; // how many players chose it
  isCorrect: boolean;
}

/** Reveal payload after a question closes. */
export interface RevealView {
  questionIndex: number;
  correctIndex: number;
  distribution: RevealOption[];
  /** Per-recipient — the points THIS player just earned and their new total. */
  you: { earned: number; total: number; wasCorrect: boolean } | null;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

/** Full room snapshot used on join / reconnect to rehydrate any client into the live phase. */
export interface RoomSnapshot {
  roomCode: string;
  quizTopic: string;
  phase: GamePhase;
  players: PlayerView[];
  you: { id: string; nickname: string; isCreator: boolean } | null;
  question: QuestionView | null; // present in "question" phase
  reveal: RevealView | null; // present in "reveal" phase
  leaderboard: LeaderboardEntry[] | null; // present in "leaderboard" | "final"
  /** True once the current player has locked an answer for the active question. */
  youAnswered: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO event contract
// ─────────────────────────────────────────────────────────────────────────────

/** Client → Server events. */
export interface ClientToServerEvents {
  /**
   * Join a room. `playerToken` reattaches a returning player to their existing
   * identity + score after a disconnect (stored in localStorage on the client).
   */
  "room:join": (
    payload: { roomCode: string; nickname: string; playerToken?: string },
    ack: (res: JoinResult) => void,
  ) => void;

  /** Creator only. Locks the lobby and starts the game. */
  "game:start": (ack: (res: SimpleResult) => void) => void;

  /** Submit an answer for the active question. Server ignores late/duplicate answers. */
  "answer:submit": (
    payload: { questionIndex: number; optionIndex: number },
    ack: (res: SimpleResult) => void,
  ) => void;

  /** Re-request the current snapshot (e.g. after transport reconnect). */
  "room:resync": (ack: (res: { snapshot: RoomSnapshot } | ErrorResult) => void) => void;
}

/** Server → Client events (broadcast/pushed). */
export interface ServerToClientEvents {
  /** Authoritative snapshot; sent on join, reconnect, and every phase change. */
  "room:snapshot": (snapshot: RoomSnapshot) => void;
  /** Lobby roster changed (join/leave/rename/connection change). */
  "room:players": (players: PlayerView[]) => void;
  /** A new question opened. */
  "game:question": (question: QuestionView) => void;
  /** The active question closed; here is the reveal (per-recipient `you`). */
  "game:reveal": (reveal: RevealView) => void;
  /** Between-question standings. */
  "game:leaderboard": (leaderboard: LeaderboardEntry[]) => void;
  /** Game over — final standings. */
  "game:final": (leaderboard: LeaderboardEntry[]) => void;
  /** Recoverable error surfaced to the user (e.g. room not found, game already started). */
  "room:error": (err: { code: RoomErrorCode; message: string }) => void;
}

// Ack result shapes
export type RoomErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_LOCKED" // game already started
  | "NICK_TAKEN"
  | "NOT_CREATOR"
  | "BAD_STATE"
  | "RATE_LIMITED";

export interface ErrorResult {
  ok: false;
  code: RoomErrorCode;
  message: string;
}
export interface SimpleResult {
  ok: boolean;
  code?: RoomErrorCode;
  message?: string;
}
export type JoinResult =
  | {
      ok: true;
      playerToken: string; // persist in localStorage
      snapshot: RoomSnapshot;
    }
  | ErrorResult;

// ─────────────────────────────────────────────────────────────────────────────
// REST contract (quiz creation — auth-gated, server calls Claude)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/quizzes  (requires an authenticated creator session) */
export interface CreateQuizRequest {
  topic: string;
  count: number; // MIN_QUESTIONS..MAX_QUESTIONS
  difficulty: Difficulty;
  timerSeconds: 10 | 20 | 30;
}
/** Response contains NO answers — just enough to open a room. */
export interface CreateQuizResponse {
  quizId: string;
  roomCode: string;
  topic: string;
  questionCount: number;
}

/** GET /api/me */
export interface MeResponse {
  user: { id: string; name: string; email: string; avatarUrl?: string } | null;
}

/**
 * GET /api/config — public, unauthenticated. Runtime config the client needs before/without
 * a session. `publicBaseUrl` is the origin the client should build shareable invite links from
 * (e.g. a pretty custom domain), falling back to the current window origin when null.
 */
export interface ConfigResponse {
  publicBaseUrl: string | null;
}

/** A past game's result summary (GET /api/quizzes/:id/results). */
export interface GameResultSummary {
  gameId: string;
  quizId: string;
  playedAt: string; // ISO
  winners: { nickname: string; score: number; rank: number }[];
  playerCount: number;
}
