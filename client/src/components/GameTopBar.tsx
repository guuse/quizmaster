import { useRoom } from "../context/RoomContext";
import { fmt } from "../lib/util";
import { Avatar } from "./Avatar";
import { WifiOff } from "lucide-react";

/**
 * Slim in-game header: this player's nickname + live score on the left, a phase/context
 * label on the right. Shows a reconnecting indicator if the socket drops mid-game.
 */
export function GameTopBar({ rightLabel }: { rightLabel: string }) {
  const { snapshot, players, connected } = useRoom();
  const you = snapshot?.you;
  const me = players.find((p) => p.id === you?.id);
  const score = me?.score ?? 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2">
      <div className="flex items-center gap-2 font-bold text-ink">
        {you && <Avatar name={you.nickname} seed={you.id} size={24} />}
        <span className="max-w-[8rem] truncate">{you?.nickname ?? "You"}</span>
        <span className="tnum text-sub">· {fmt(score)} pts</span>
      </div>
      <div className="flex items-center gap-2">
        {!connected && (
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-destructive" title="Reconnecting">
            <WifiOff size={14} aria-hidden="true" />
            <span className="sr-only">Reconnecting</span>
          </span>
        )}
        <span className="tnum text-[13px] font-extrabold text-sub">{rightLabel}</span>
      </div>
    </div>
  );
}
