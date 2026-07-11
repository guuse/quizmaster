/**
 * Auth endpoints. Creators sign in with Google; players never authenticate.
 *
 *   GET  /api/auth/google           -> redirect to Google consent
 *   GET  /api/auth/google/callback  -> exchange code, create session, redirect home
 *   POST /api/auth/logout           -> destroy session
 *   GET  /api/me                    -> MeResponse
 *   POST /api/auth/dev-login        -> DEV ONLY (QUIZMASTER_DEV_AUTH=1): throwaway user
 *
 * When the Google env vars are unset, the Google routes return a clear
 * "not configured" error instead of crashing.
 */
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { MeResponse } from "@quizmaster/shared";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../env.js";
import { createSession, destroySession, getUserFromCookie, type SessionContext } from "./session.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function createAuthRouter(prisma: PrismaClient, env: Env): Router {
  const router = Router();
  const ctx: SessionContext = { prisma, env };

  function googleConfigured(): boolean {
    return Boolean(env.googleClientId && env.googleClientSecret && env.oauthRedirectUri);
  }

  // Kick off the Google OAuth dance.
  router.get("/auth/google", (_req: Request, res: Response) => {
    if (!googleConfigured()) {
      res.status(503).json({ error: "google_oauth_not_configured", message: "Google OAuth is not configured on this server." });
      return;
    }
    const params = new URLSearchParams({
      client_id: env.googleClientId!,
      redirect_uri: env.oauthRedirectUri!,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // OAuth callback: exchange the code, upsert the user, set the session cookie.
  router.get("/auth/google/callback", async (req: Request, res: Response) => {
    if (!googleConfigured()) {
      res.status(503).json({ error: "google_oauth_not_configured", message: "Google OAuth is not configured on this server." });
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : null;
    if (!code) {
      res.status(400).json({ error: "missing_code" });
      return;
    }
    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.googleClientId!,
          client_secret: env.googleClientSecret!,
          redirect_uri: env.oauthRedirectUri!,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        res.status(502).json({ error: "token_exchange_failed" });
        return;
      }
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) {
        res.status(502).json({ error: "no_access_token" });
        return;
      }
      const infoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!infoRes.ok) {
        res.status(502).json({ error: "userinfo_failed" });
        return;
      }
      const info = (await infoRes.json()) as {
        sub: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      const user = await prisma.user.upsert({
        where: { googleId: info.sub },
        create: {
          googleId: info.sub,
          email: info.email ?? `${info.sub}@users.noreply.google`,
          name: info.name ?? "Quizmaster",
          avatarUrl: info.picture ?? null,
        },
        update: {
          email: info.email ?? undefined,
          name: info.name ?? undefined,
          avatarUrl: info.picture ?? null,
        },
      });
      await createSession(ctx, res, user.id);
      res.redirect("/");
    } catch {
      res.status(502).json({ error: "oauth_error" });
    }
  });

  // Dev-only login — enabled strictly when QUIZMASTER_DEV_AUTH=1. Creates a throwaway
  // creator so the app (and the automated smoke test) can be driven without Google.
  router.post("/auth/dev-login", async (req: Request, res: Response) => {
    if (!env.devAuth) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : "Dev Creator";
    const fakeId = `dev-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        googleId: fakeId,
        email: `${fakeId}@dev.local`,
        name: name.slice(0, 100),
      },
    });
    await createSession(ctx, res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });

  router.post("/auth/logout", async (req: Request, res: Response) => {
    await destroySession(ctx, req, res);
    res.json({ ok: true });
  });

  router.get("/me", async (req: Request, res: Response) => {
    const user = await getUserFromCookie(ctx, req.headers.cookie);
    const body: MeResponse = {
      user: user
        ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? undefined }
        : null,
    };
    res.json(body);
  });

  return router;
}
