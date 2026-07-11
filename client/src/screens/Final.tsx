import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Repeat, Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@quizmaster/shared";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { LiveRegion } from "../components/LiveRegion";
import { useRoom } from "../context/RoomContext";
import { playAgain, ApiError } from "../lib/api";
import { loadQuizId, saveQuizId } from "../lib/storage";
import { cn, fmt } from "../lib/util";

export function Final() {
  const navigate = useNavigate();
  const { roomCode, snapshot, leave } = useRoom();
  const entries = snapshot?.leaderboard ?? [];
  const youId = snapshot?.you?.id;
  const isCreator = !!snapshot?.you?.isCreator;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const winner = entries.find((e) => e.rank === 1);

  // Podium order: 2nd (left), 1st (center), 3rd (right).
  const first = entries.find((e) => e.rank === 1) ?? null;
  const second = entries.find((e) => e.rank === 2) ?? null;
  const third = entries.find((e) => e.rank === 3) ?? null;

  async function handlePlayAgain() {
    const quizId = loadQuizId(roomCode);
    if (!quizId) {
      navigate("/");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await playAgain(quizId);
      saveQuizId(res.roomCode, res.quizId);
      leave(); // drop this room's socket + stored identity
      navigate(`/room/${res.roomCode}`);
    } catch (e) {
      // If replay isn't available, fall back to the create screen.
      if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
        navigate("/");
        return;
      }
      setErr("Couldn't start a rematch. Try again.");
      setBusy(false);
    }
  }

  function goHome() {
    leave();
    navigate("/");
  }

  return (
    <Shell wide testId="phase-final">
      <LiveRegion message={winner ? `Game over. ${winner.nickname} wins with ${winner.score} points.` : "Game over."} assertive />

      <div className="mt-2 flex items-center justify-center gap-2 text-center">
        <Trophy size={26} className="text-accent" aria-hidden="true" />
        <h1 className="font-display text-3xl text-ink">
          {winner ? `${winner.nickname} wins!` : "Final results"}
        </h1>
      </div>

      {/* Podium */}
      <div className="mt-6 flex items-end justify-center gap-2">
        <PodiumCol entry={second} place={2} youId={youId} />
        <PodiumCol entry={first} place={1} youId={youId} />
        <PodiumCol entry={third} place={3} youId={youId} />
      </div>

      {/* Full ranking */}
      <section className="mt-6">
        <h2 className="px-1 text-sm font-extrabold uppercase tracking-wide text-sub">Full ranking</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {entries.map((e) => (
            <li
              key={e.playerId}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                e.rank === 1 ? "border-accent/70 bg-gradient-to-r from-accent/20 to-panel" : "border-line bg-panel",
                e.playerId === youId && "ring-2 ring-primary/60",
              )}
            >
              <span className={cn("tnum w-6 text-center font-display text-lg", e.rank === 1 ? "text-accent" : "text-sub")}>
                {e.rank}
              </span>
              <Avatar name={e.nickname} seed={e.playerId} />
              <span className="flex-1 truncate font-bold text-ink">{e.nickname}</span>
              <span className="tnum font-display text-lg text-ink">{fmt(e.score)}</span>
            </li>
          ))}
        </ul>
      </section>

      {err && <p role="alert" className="mt-3 text-center text-sm text-destructive">{err}</p>}

      <div className="mt-auto flex gap-2 pt-6">
        {isCreator && (
          <button
            type="button"
            onClick={handlePlayAgain}
            disabled={busy}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-display text-lg text-[#241a00] shadow-[0_5px_0_#a9760a] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#a9760a] disabled:opacity-60"
          >
            <Repeat size={20} aria-hidden="true" /> {busy ? "…" : "Play again"}
          </button>
        )}
        <button
          type="button"
          onClick={goHome}
          className={cn(
            "flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-line bg-panel px-4 font-bold text-ink transition-transform active:translate-y-[2px]",
            isCreator ? "flex-1" : "w-full",
          )}
        >
          <Home size={20} aria-hidden="true" /> Home
        </button>
      </div>
    </Shell>
  );
}

function PodiumCol({
  entry,
  place,
  youId,
}: {
  entry: LeaderboardEntry | null;
  place: 1 | 2 | 3;
  youId?: string;
}) {
  const heights = { 1: "h-28", 2: "h-20", 3: "h-16" } as const;
  const bg = {
    1: "bg-accent text-[#241a00]",
    2: "bg-[#c8d2e6] text-[#241a00]",
    3: "bg-[#e0955a] text-[#241a00]",
  } as const;

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      {entry ? (
        <>
          <Avatar name={entry.nickname} seed={entry.playerId} size={place === 1 ? 40 : 32} />
          <span className={cn("max-w-full truncate text-center text-sm font-bold text-ink", entry.playerId === youId && "underline")}>
            {entry.nickname}
          </span>
          <span className="tnum text-[11px] font-bold text-sub">{fmt(entry.score)}</span>
        </>
      ) : (
        <span className="text-xs text-sub">—</span>
      )}
      <div
        className={cn(
          "grid w-full place-items-start justify-center rounded-t-xl pt-2 font-display text-xl",
          heights[place],
          bg[place],
        )}
      >
        {place}
      </div>
    </div>
  );
}
