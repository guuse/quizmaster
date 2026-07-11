import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Shell } from "../components/Shell";
import { CreatePanel } from "./CreatePanel";
import { useSession } from "../context/SessionContext";

/**
 * /room/:code/new — the host generates a NEW quiz for an EXISTING room. On success the server
 * re-arms that room (same code, players kept, scores reset) and everyone jumps into a fresh lobby.
 * Only a signed-in creator reaches this; the server also enforces room ownership.
 */
export function RoomCreate() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useSession();

  if (!code) return <Navigate to="/" replace />;
  if (loading) {
    return (
      <Shell>
        <div className="mt-16 h-40 animate-pulseglow rounded-2xl bg-muted" aria-hidden="true" />
      </Shell>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const roomCode = code.toUpperCase();
  return (
    <Shell>
      <Link
        to={`/room/${roomCode}`}
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-sub hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to room {roomCode}
      </Link>
      <h1 className="mt-3 font-display text-2xl text-ink">
        New quiz for room <span className="tnum text-accent">{roomCode}</span>
      </h1>
      <p className="mt-1 text-sub">
        Generate a fresh quiz — everyone still in the room jumps into a new lobby.
      </p>
      <CreatePanel name={user.name} roomCode={roomCode} heading="New quiz" />
    </Shell>
  );
}
