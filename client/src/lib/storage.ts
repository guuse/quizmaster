/**
 * Per-room reconnection identity. On a successful join the server issues a `playerToken`;
 * we persist it (keyed by room code) so a refresh or transport reconnect can reattach to
 * the same player + score by re-emitting `room:join` with the token. The chosen nickname
 * is stored alongside so a token rejoin can still carry it.
 */
export interface StoredMembership {
  playerToken: string;
  nickname: string;
}

const KEY = (code: string) => `qm.room.${code.toUpperCase()}`;

export function loadMembership(code: string): StoredMembership | null {
  try {
    const raw = localStorage.getItem(KEY(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMembership;
    if (parsed && typeof parsed.playerToken === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveMembership(code: string, m: StoredMembership): void {
  try {
    localStorage.setItem(KEY(code), JSON.stringify(m));
  } catch {
    /* private mode / quota — non-fatal, we just lose reconnect identity. */
  }
}

export function clearMembership(code: string): void {
  try {
    localStorage.removeItem(KEY(code));
  } catch {
    /* ignore */
  }
}

/**
 * The creator's quizId for a room, so the final screen's "Play again" can POST
 * /api/quizzes/:id/play. Only the creator sets this (at generation time); absent for
 * players who joined via a link, whose final screen simply omits "Play again".
 */
const QUIZ_KEY = (code: string) => `qm.quiz.${code.toUpperCase()}`;

export function saveQuizId(code: string, quizId: string): void {
  try {
    localStorage.setItem(QUIZ_KEY(code), quizId);
  } catch {
    /* ignore */
  }
}

export function loadQuizId(code: string): string | null {
  try {
    return localStorage.getItem(QUIZ_KEY(code));
  } catch {
    return null;
  }
}
