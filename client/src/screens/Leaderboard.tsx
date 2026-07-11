import { useLayoutEffect, useRef } from "react";
import { Crown } from "lucide-react";
import { Shell } from "../components/Shell";
import { Avatar } from "../components/Avatar";
import { LiveRegion } from "../components/LiveRegion";
import { GameTopBar } from "../components/GameTopBar";
import { useRoom } from "../context/RoomContext";
import { cn, fmt } from "../lib/util";

export function Leaderboard() {
  const { snapshot } = useRoom();
  const entries = snapshot?.leaderboard ?? [];
  const youId = snapshot?.you?.id;

  // FLIP: animate rows from their previous position to the new one on reorder.
  const nodes = useRef(new Map<string, HTMLLIElement>());
  const prevTops = useRef(new Map<string, number>());
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (prefersReduced) return;
    nodes.current.forEach((node, id) => {
      const newTop = node.offsetTop;
      const prev = prevTops.current.get(id);
      if (prev != null && prev !== newTop) {
        const delta = prev - newTop;
        node.style.transition = "none";
        node.style.transform = `translateY(${delta}px)`;
        // Force reflow, then animate to the resting position.
        void node.offsetHeight;
        node.style.transition = "transform 420ms cubic-bezier(0.2,0.8,0.2,1)";
        node.style.transform = "";
      }
      prevTops.current.set(id, newTop);
    });
  });

  const topName = entries[0]?.nickname;

  return (
    <Shell wide testId="phase-leaderboard">
      <LiveRegion message={topName ? `Standings updated. ${topName} is in the lead.` : "Standings updated."} />
      <GameTopBar rightLabel="Standings" />

      <h1 className="mt-4 px-1 font-display text-2xl text-ink">Leaderboard</h1>

      <ul className="relative mt-3 flex flex-col gap-2">
        {entries.map((e) => (
          <li
            key={e.playerId}
            ref={(n) => {
              if (n) nodes.current.set(e.playerId, n);
              else nodes.current.delete(e.playerId);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 will-change-transform",
              e.rank === 1
                ? "border-accent/70 bg-gradient-to-r from-accent/25 to-panel"
                : "border-line bg-panel",
              e.playerId === youId && "ring-2 ring-primary/60",
            )}
          >
            <span
              className={cn(
                "tnum w-6 text-center font-display text-lg",
                e.rank === 1 ? "text-accent" : "text-sub",
              )}
            >
              {e.rank}
            </span>
            <Avatar name={e.nickname} seed={e.playerId} />
            <span className="flex-1 truncate font-bold text-ink">
              {e.nickname}
              {e.playerId === youId && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-sub">you</span>
              )}
            </span>
            {e.rank === 1 && <Crown size={18} className="text-accent" aria-hidden="true" />}
            <span className="tnum font-display text-lg text-ink">{fmt(e.score)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-6 text-center text-sm font-bold text-sub motion-safe:animate-pulseglow">
        Next question coming up…
      </p>
    </Shell>
  );
}
