import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  JoinResult,
  PlayerView,
  RoomSnapshot,
  SimpleResult,
} from "@quizmaster/shared";
import { createSocket, type QuizSocket } from "../lib/socket";
import {
  clearMembership,
  loadMembership,
  saveMembership,
} from "../lib/storage";

/**
 * Owns the single socket connection for one room and exposes the latest RoomSnapshot as
 * the app's source of truth. Everything the screens render (phase, question, reveal,
 * leaderboard, roster) comes off `snapshot`, so a mid-game refresh or a transport
 * reconnect rehydrates into the correct phase automatically.
 *
 * Reconnection: on every socket `connect` (including automatic reconnects) we re-emit
 * `room:join` with the stored `playerToken`, which reattaches this client to the same
 * player + score on the server and returns a fresh snapshot.
 */
export type RoomStatus =
  | "connecting" // socket not yet connected
  | "needs-nickname" // connected, no stored identity — show the join form
  | "joining" // join emitted, awaiting ack
  | "joined" // in the room; render off snapshot
  | "error"; // unrecoverable (e.g. room not found)

interface LocalAnswer {
  questionIndex: number;
  optionIndex: number;
}

interface RoomContextValue {
  roomCode: string;
  status: RoomStatus;
  error: string | null;
  connected: boolean;
  snapshot: RoomSnapshot | null;
  players: PlayerView[];
  /** The option THIS client locked for the active question (optimistic, local). */
  localAnswer: LocalAnswer | null;
  join: (nickname: string) => void;
  start: () => void;
  submitAnswer: (optionIndex: number) => void;
  leave: () => void;
  dismissError: () => void;
}

const RoomCtx = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomCtx);
  if (!ctx) throw new Error("useRoom must be used within a RoomProvider");
  return ctx;
}

export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const roomCode = code.toUpperCase();
  const socketRef = useRef<QuizSocket | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [localAnswer, setLocalAnswer] = useState<LocalAnswer | null>(null);

  // Refs the (stable) socket event handlers read so they always see the latest values.
  const tokenRef = useRef<string | null>(null);
  const nicknameRef = useRef<string>("");
  const joinedRef = useRef(false);

  const applyJoinResult = useCallback(
    (res: JoinResult, nickname: string) => {
      if (res.ok) {
        tokenRef.current = res.playerToken;
        nicknameRef.current = res.snapshot.you?.nickname ?? nickname;
        saveMembership(roomCode, {
          playerToken: res.playerToken,
          nickname: nicknameRef.current,
        });
        joinedRef.current = true;
        setSnapshot(res.snapshot);
        setStatus("joined");
        setError(null);
      } else {
        // Token rejoin failed. ROOM_NOT_FOUND is terminal; otherwise drop the stale
        // identity and fall back to the nickname form with a friendly message.
        if (res.code === "ROOM_NOT_FOUND") {
          setStatus("error");
          setError("That room doesn't exist anymore.");
        } else {
          clearMembership(roomCode);
          tokenRef.current = null;
          joinedRef.current = false;
          setStatus("needs-nickname");
          setError(friendly(res.code, res.message));
        }
      }
    },
    [roomCode],
  );

  const emitJoin = useCallback(
    (nickname: string, withToken: boolean) => {
      const socket = socketRef.current;
      if (!socket) return;
      setStatus("joining");
      socket.emit(
        "room:join",
        {
          roomCode,
          nickname,
          playerToken: withToken ? tokenRef.current ?? undefined : undefined,
        },
        (res: JoinResult) => applyJoinResult(res, nickname),
      );
    },
    [roomCode, applyJoinResult],
  );

  // ── Socket lifecycle (one per room) ──────────────────────────────────────────
  useEffect(() => {
    const stored = loadMembership(roomCode);
    if (stored) {
      tokenRef.current = stored.playerToken;
      nicknameRef.current = stored.nickname;
    }

    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // If we hold an identity (fresh session with a stored token, or a reconnect after
      // a successful join), reattach by re-emitting join with the token.
      if (tokenRef.current) {
        emitJoin(nicknameRef.current, true);
      } else if (!joinedRef.current) {
        setStatus("needs-nickname");
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room:snapshot", (snap) => {
      setSnapshot(snap);
      joinedRef.current = true;
      setStatus("joined");
    });

    socket.on("room:players", (players) => {
      setSnapshot((prev) => (prev ? { ...prev, players } : prev));
    });

    // The engine also pushes a fresh snapshot on every phase change, so these discrete
    // events are informational; snapshot remains the single source of truth.
    socket.on("room:error", (err) => {
      setError(friendly(err.code, err.message));
      if (err.code === "ROOM_NOT_FOUND") setStatus("error");
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Reset the optimistic local answer whenever a new question opens or we leave the
  // question phase, so tiles unlock for the next round.
  const activeQIndex =
    snapshot?.phase === "question" ? snapshot.question?.index ?? null : null;
  useEffect(() => {
    setLocalAnswer((prev) =>
      prev && prev.questionIndex === activeQIndex ? prev : null,
    );
  }, [activeQIndex, snapshot?.phase]);

  const join = useCallback(
    (nickname: string) => {
      nicknameRef.current = nickname;
      emitJoin(nickname, false);
    },
    [emitJoin],
  );

  const start = useCallback(() => {
    socketRef.current?.emit("game:start", (res: SimpleResult) => {
      if (!res.ok) setError(friendly(res.code, res.message));
    });
  }, []);

  const submitAnswer = useCallback(
    (optionIndex: number) => {
      const snap = snapshot;
      if (!snap || snap.phase !== "question" || !snap.question) return;
      const questionIndex = snap.question.index;
      if (localAnswer) return; // already locked for this question
      setLocalAnswer({ questionIndex, optionIndex });
      socketRef.current?.emit(
        "answer:submit",
        { questionIndex, optionIndex },
        (res: SimpleResult) => {
          // If the server rejected because the window closed, keep the lock (the reveal
          // is imminent). Only a hard rejection while still open reverts the choice.
          if (!res.ok && res.code === "BAD_STATE") {
            setLocalAnswer((prev) =>
              prev && prev.questionIndex === questionIndex ? null : prev,
            );
          }
        },
      );
    },
    [snapshot, localAnswer],
  );

  const leave = useCallback(() => {
    clearMembership(roomCode);
    tokenRef.current = null;
    joinedRef.current = false;
    socketRef.current?.disconnect();
  }, [roomCode]);

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<RoomContextValue>(
    () => ({
      roomCode,
      status,
      error,
      connected,
      snapshot,
      players: snapshot?.players ?? [],
      localAnswer,
      join,
      start,
      submitAnswer,
      leave,
      dismissError,
    }),
    [
      roomCode,
      status,
      error,
      connected,
      snapshot,
      localAnswer,
      join,
      start,
      submitAnswer,
      leave,
      dismissError,
    ],
  );

  return <RoomCtx.Provider value={value}>{children}</RoomCtx.Provider>;
}

function friendly(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "That room code doesn't exist.";
    case "ROOM_LOCKED":
      return "This game has already started — you can't join now.";
    case "NICK_TAKEN":
      return "That nickname is already taken. Try another.";
    case "NOT_CREATOR":
      return "Only the game's creator can start it.";
    case "RATE_LIMITED":
      return "Too many attempts. Please wait a moment.";
    default:
      return fallback || "Something went wrong. Please try again.";
  }
}
