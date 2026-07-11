import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { MeResponse } from "@quizmaster/shared";
import { getConfig, getMe, logout as apiLogout } from "../lib/api";

type User = NonNullable<MeResponse["user"]>;

interface SessionValue {
  user: User | null;
  loading: boolean;
  /** Origin for shareable invite links (a pretty custom domain), or null → use window origin. */
  publicBaseUrl: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionCtx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
    // Public config is static per deploy; fetch once, ignore failures (falls back to origin).
    getConfig()
      .then((c) => setPublicBaseUrl(c.publicBaseUrl))
      .catch(() => setPublicBaseUrl(null));
  }, [refresh]);

  return (
    <SessionCtx.Provider value={{ user, loading, publicBaseUrl, refresh, logout }}>
      {children}
    </SessionCtx.Provider>
  );
}
