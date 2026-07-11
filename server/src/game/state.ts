/**
 * In-memory live game state. NONE of this is persisted — it lives only in the single
 * server process (see CONTEXT.md). Only a final GameResult row is written at game end.
 */
import type { GamePhase, Question } from "@quizmaster/shared";

/** One player's record of their answer to a single question. */
export interface AnswerRecord {
  optionIndex: number;
  elapsedMs: number;
  earned: number;
  correct: boolean;
}

export interface PlayerState {
  id: string;
  /** Secret reconnection token; presenting it reattaches to this identity + score. */
  token: string;
  nickname: string;
  score: number;
  isCreator: boolean;
  connected: boolean;
  socketId: string | null;
  /** Answers by question index. Missing entry = never answered (0 points). */
  answers: Map<number, AnswerRecord>;
}

export interface Room {
  code: string;
  quizId: string;
  topic: string;
  /** The creator's user id (from their session). Used to mark their player as creator. */
  ownerUserId: string;
  timerSeconds: number;
  /** Full questions INCLUDING correctIndex — server-only, never serialized to players. */
  questions: Question[];

  phase: GamePhase;
  players: Map<string, PlayerState>;
  /** playerId of the creator, once they've joined. */
  creatorPlayerId: string | null;

  /** 0-based index of the active/last question. -1 in lobby. */
  currentQuestionIndex: number;
  questionStartedAt: number; // epoch ms
  questionEndsAt: number; // epoch ms

  /** During the "countdown" phase: when it ends (epoch ms) and which question opens next. */
  countdownEndsAt: number;
  countdownNextIndex: number;

  finalWritten: boolean;
  /** Epoch ms since the room last had zero connected players (for the reaper). */
  emptySince: number | null;

  /** Active phase timer handle, so an early close can cancel the auto-close. */
  timer: NodeJS.Timeout | null;
}
