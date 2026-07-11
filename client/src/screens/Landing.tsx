import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, LogOut } from "lucide-react";
import { Shell } from "../components/Shell";
import { CreatePanel } from "./CreatePanel";
import { useSession } from "../context/SessionContext";
import { ApiError, devLogin, isDevEnvironment } from "../lib/api";

export function Landing() {
  const { user, loading, refresh, logout } = useSession();

  return (
    <Shell
      right={
        user ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-line bg-panel px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:border-primary"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        ) : undefined
      }
    >
      <Hero />
      {loading ? (
        <div className="mt-6 h-40 animate-pulseglow rounded-2xl bg-muted" aria-hidden="true" />
      ) : user ? (
        <CreatePanel name={user.name} />
      ) : (
        <LoggedOutPanel onDevLogin={refresh} />
      )}
      <JoinPanel />
    </Shell>
  );
}

function Hero() {
  return (
    <section className="mt-2">
      <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary">
        Party-game quiz · live &amp; multiplayer
      </span>
      <h1 className="mt-2 font-display text-display leading-none">
        Claude writes it.
        <br />
        Nobody sees the <span className="text-accent">answers</span>.
      </h1>
      <p className="mt-3 max-w-[52ch] text-sub">
        Generate a quiz from any topic, share the code, and everyone plays together in real
        time — synchronized questions, a live countdown, and a leaderboard that leaps.
      </p>
    </section>
  );
}

function LoggedOutPanel({ onDevLogin }: { onDevLogin: () => Promise<void> }) {
  const [devName, setDevName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDevLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await devLogin(devName.trim() || "Dev Creator");
      await onDevLogin();
    } catch (e2) {
      setErr(
        e2 instanceof ApiError && e2.status === 404
          ? "Dev login is disabled on this server (set QUIZMASTER_DEV_AUTH=1)."
          : "Dev login failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-block">
      <h2 className="font-display text-xl">Create a quiz</h2>
      <p className="mt-1 text-sm text-sub">Sign in to generate — it's how we keep Claude usage in check.</p>
      <a
        href="/api/auth/google"
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-3 font-bold text-[#1f2430] shadow-block transition-transform active:translate-y-[2px]"
      >
        <GoogleMark />
        Sign in with Google
      </a>

      {isDevEnvironment() && (
        <form onSubmit={handleDevLogin} className="mt-4 border-t border-line pt-4">
          <label htmlFor="devname" className="text-[12px] font-extrabold uppercase tracking-wide text-sub">
            Dev login (local only)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="devname"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              placeholder="Your name"
              className="min-h-[44px] flex-1 rounded-xl border-[1.5px] border-line bg-muted px-3 text-base text-ink placeholder:text-sub/70"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-[1.5px] border-line bg-muted px-4 font-bold text-ink transition-colors hover:border-primary disabled:opacity-60"
            >
              <LogIn size={16} aria-hidden="true" />
              {busy ? "…" : "Go"}
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        </form>
      )}
    </section>
  );
}

function JoinPanel() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <section className="mt-5 rounded-2xl border border-line bg-panel p-5 shadow-block">
      <h2 className="font-display text-xl">Join a game</h2>
      <p className="mt-1 text-sm text-sub">Got a room code? No sign-in needed.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (c) navigate(`/join/${c}`);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          aria-label="Room code"
          autoCapitalize="characters"
          className="tnum min-h-[48px] w-full flex-1 rounded-xl border-[1.5px] border-line bg-muted px-3 text-center text-lg font-extrabold tracking-[0.2em] text-ink placeholder:tracking-normal placeholder:text-sub/60"
        />
        <button
          type="submit"
          className="min-h-[48px] rounded-xl bg-primary px-5 font-bold text-on-primary transition-transform active:translate-y-[2px]"
        >
          Join
        </button>
      </form>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
