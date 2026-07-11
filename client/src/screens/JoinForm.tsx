import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Shell } from "../components/Shell";
import { useRoom } from "../context/RoomContext";
import { useSession } from "../context/SessionContext";

/**
 * Nickname entry for a room the player has no stored identity in. Anyone can join with
 * just a nickname — no sign-in. The creator's name is prefilled from their session.
 */
export function JoinForm() {
  const { roomCode, join, status, error } = useRoom();
  const { user } = useSession();
  const [nickname, setNickname] = useState("");

  // Prefill the creator's name once it resolves.
  useEffect(() => {
    if (user?.name && !nickname) setNickname(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const busy = status === "joining";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = nickname.trim();
    if (n) join(n);
  }

  return (
    <Shell>
      <div className="mt-8 rounded-2xl border border-line bg-panel p-6 shadow-block">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-sub">Joining room</p>
        <p className="tnum mt-1 font-display text-3xl tracking-[0.14em] text-accent">{roomCode}</p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label htmlFor="nickname" className="text-[12px] font-extrabold uppercase tracking-wide text-sub">
            Your nickname
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoFocus
            placeholder="e.g. Sanne"
            className="mt-1.5 min-h-[48px] w-full rounded-xl border-[1.5px] border-line bg-muted px-3 text-base text-ink placeholder:text-sub/70"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            data-testid="join-btn"
            disabled={busy || !nickname.trim()}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-display text-lg text-on-primary shadow-block transition-transform active:translate-y-[3px] disabled:opacity-60"
          >
            <LogIn size={20} aria-hidden="true" />
            {busy ? "Joining…" : "Join game"}
          </button>
        </form>

        <Link to="/" className="mt-4 inline-block text-sm font-bold text-sub hover:text-ink">
          ← Back home
        </Link>
      </div>
    </Shell>
  );
}
