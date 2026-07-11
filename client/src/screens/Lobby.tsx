import { useState } from "react";
import { Check, Copy, Crown, Play, Users } from "lucide-react";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { LiveRegion } from "../components/LiveRegion";
import { useRoom } from "../context/RoomContext";
import { useSession } from "../context/SessionContext";
import { inviteBaseUrl } from "../lib/api";
import { cn } from "../lib/util";

export function Lobby() {
  const { roomCode, snapshot, players, start, error } = useRoom();
  const { publicBaseUrl } = useSession();
  const [copied, setCopied] = useState(false);

  const you = snapshot?.you;
  const isCreator = !!you?.isCreator;
  // Prefer the configured pretty domain (e.g. quiz.guuse.online) over the current origin.
  const joinUrl = `${inviteBaseUrl(publicBaseUrl)}/join/${roomCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {
      /* clipboard blocked — the code is on screen regardless */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Shell wide testId="phase-lobby">
      <LiveRegion message={`Lobby. ${players.length} player${players.length === 1 ? "" : "s"} in the room.`} />

      <section className="rounded-2xl border border-line bg-panel p-6 text-center shadow-block">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-sub">Room code</p>
        <p data-testid="room-code" className="tnum mt-1 font-display text-5xl tracking-[0.16em] text-accent">
          {roomCode}
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="mx-auto mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-line bg-muted px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-primary"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </section>

      <section className="mt-4">
        <h2 className="flex items-center gap-2 px-1 text-sm font-extrabold uppercase tracking-wide text-sub">
          <Users size={16} aria-hidden="true" /> Players · {players.length}
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {players.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 font-bold shadow-sm",
                "motion-safe:animate-risein",
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <Avatar name={p.nickname} seed={p.id} />
              <span className={cn("text-ink", !p.connected && "opacity-50")}>{p.nickname}</span>
              {p.id === you?.id && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-sub">you</span>
              )}
              {p.isCreator && (
                <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-accent">
                  <Crown size={14} aria-hidden="true" /> host
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-auto pt-6">
        {isCreator ? (
          <button
            type="button"
            data-testid="start-btn"
            onClick={start}
            disabled={players.length === 0}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-display text-xl text-[#241a00] shadow-[0_5px_0_#a9760a] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#a9760a] disabled:opacity-60"
          >
            <Play size={22} aria-hidden="true" /> Start game
          </button>
        ) : (
          <div className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-panel px-4 font-bold text-sub">
            <span className="motion-safe:animate-pulseglow">Waiting for the host to start…</span>
          </div>
        )}
      </div>
    </Shell>
  );
}
