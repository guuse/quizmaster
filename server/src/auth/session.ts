/**
 * Session management for creators. A session is a row in the `sessions` table; the
 * session id is stored in an httpOnly cookie. Players never authenticate — only
 * creators (who generate quizzes and can start their room) have sessions.
 */
import type { Request, Response } from "express";
import * as cookie from "cookie";
import type { PrismaClient, User } from "@prisma/client";
import type { Env } from "../env.js";

export const SESSION_COOKIE = "qm_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionContext {
  prisma: PrismaClient;
  env: Env;
}

/** Create a session row for a user and set the cookie on the response. */
export async function createSession(
  ctx: SessionContext,
  res: Response,
  userId: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await ctx.prisma.session.create({
    data: { userId, expiresAt },
  });
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: ctx.env.isProduction,
      path: "/",
      expires: expiresAt,
    }),
  );
}

/** Clear the current session (delete the row + expire the cookie). */
export async function destroySession(ctx: SessionContext, req: Request, res: Response): Promise<void> {
  const sid = readSessionId(req.headers.cookie);
  if (sid) {
    await ctx.prisma.session.deleteMany({ where: { id: sid } });
  }
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: ctx.env.isProduction,
      path: "/",
      expires: new Date(0),
    }),
  );
}

/** Resolve the authenticated user for a raw cookie header, or null. */
export async function getUserFromCookie(
  ctx: SessionContext,
  cookieHeader: string | undefined,
): Promise<User | null> {
  const sid = readSessionId(cookieHeader);
  if (!sid) return null;
  const session = await ctx.prisma.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await ctx.prisma.session.deleteMany({ where: { id: sid } }).catch(() => {});
    return null;
  }
  return session.user;
}

export function readSessionId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parsed = cookie.parse(cookieHeader);
  return parsed[SESSION_COOKIE] ?? null;
}
