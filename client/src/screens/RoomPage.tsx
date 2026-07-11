import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { RoomProvider, useRoom } from "../context/RoomContext";
import { Shell } from "../components/Shell";
import { JoinForm } from "./JoinForm";
import { Lobby } from "./Lobby";
import { Countdown } from "./Countdown";
import { Question } from "./Question";
import { Reveal } from "./Reveal";
import { Leaderboard } from "./Leaderboard";
import { Final } from "./Final";

/** Route entry for /room/:code and /join/:code. Provides the room socket, then renders. */
export function RoomRoute() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <RoomError message="No room code in the link." />;
  // `key` remounts the provider (fresh socket + state) whenever the room code changes —
  // e.g. "Play again" navigating from /room/OLD to /room/NEW.
  return (
    <RoomProvider key={code.toUpperCase()} code={code}>
      <RoomView />
    </RoomProvider>
  );
}

function RoomView() {
  const { status, snapshot } = useRoom();

  if (status === "error") {
    return <RoomError message="That room doesn't exist anymore." />;
  }

  // No snapshot yet: either still connecting, or we need a nickname.
  if (!snapshot) {
    if (status === "connecting") return <Connecting />;
    return <JoinForm />;
  }

  switch (snapshot.phase) {
    case "lobby":
      return <Lobby />;
    case "countdown":
      return <Countdown />;
    case "question":
      return <Question />;
    case "reveal":
      return <Reveal />;
    case "leaderboard":
      return <Leaderboard />;
    case "final":
      return <Final />;
    default:
      return <Connecting />;
  }
}

function Connecting() {
  return (
    <Shell>
      <div className="mt-16 flex flex-col items-center gap-3 text-sub" aria-busy="true">
        <Loader2 size={28} className="motion-safe:animate-spin" aria-hidden="true" />
        <p className="font-bold">Connecting…</p>
      </div>
    </Shell>
  );
}

export function RoomError({ message }: { message: string }) {
  return (
    <Shell>
      <div className="mt-16 rounded-2xl border border-line bg-panel p-6 text-center shadow-block">
        <p className="font-display text-2xl">Hmm.</p>
        <p className="mt-2 text-sub">{message}</p>
        <Link
          to="/"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-primary px-6 font-bold text-on-primary"
        >
          Back home
        </Link>
      </div>
    </Shell>
  );
}
