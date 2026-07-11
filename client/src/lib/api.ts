/**
 * Thin REST client for the auth + quiz endpoints. Same-origin in both dev (via the Vite
 * proxy) and prod (server serves the SPA), so cookies flow automatically with
 * `credentials: "include"`.
 */
import type {
  CreateQuizRequest,
  CreateQuizResponse,
  MeResponse,
} from "@quizmaster/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || `Request failed (${res.status}).`;
    throw new ApiError(res.status, message, data?.error);
  }
  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/me");
}

/** Dev-only login (server must run with QUIZMASTER_DEV_AUTH=1). */
export function devLogin(name: string): Promise<{ user: { id: string; name: string; email: string } }> {
  return request("/api/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request("/api/auth/logout", { method: "POST" });
}

export function createQuiz(payload: CreateQuizRequest): Promise<CreateQuizResponse> {
  return request<CreateQuizResponse>("/api/quizzes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Replay: open a fresh room for an already-generated quiz. */
export function playAgain(quizId: string): Promise<CreateQuizResponse> {
  return request<CreateQuizResponse>(`/api/quizzes/${quizId}/play`, {
    method: "POST",
  });
}

/** True when the dev-login affordance should be offered (localhost dev). */
export function isDevEnvironment(): boolean {
  return (
    import.meta.env.DEV ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  );
}
