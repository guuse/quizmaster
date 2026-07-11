/**
 * Application assembly: Express + Socket.IO on a single HTTP server. Serves the built
 * client SPA (client/dist) with an SPA fallback so deep links like /join/:code survive
 * a refresh. In dev the Vite client runs separately, so CORS is opened for it.
 *
 * `startServer` is exported so the smoke test can boot the whole stack in-process.
 */
import { existsSync } from "node:fs";
import { createServer, type Server as HttpServer } from "node:http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@quizmaster/shared";
import type { Env } from "./env.js";
import { getPrisma } from "./db.js";
import { createAuthRouter } from "./auth/routes.js";
import { createQuizRouter } from "./quiz/routes.js";
import { GameEngine } from "./game/engine.js";
import { registerSocketHandlers } from "./game/socket.js";

export interface RunningServer {
  httpServer: HttpServer;
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  engine: GameEngine;
  port: number;
  close: () => Promise<void>;
}

export async function startServer(env: Env): Promise<RunningServer> {
  const prisma = getPrisma();
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  // Dev CORS for the Vite client (credentials so the session cookie flows).
  if (env.corsOrigin) {
    const origin = env.corsOrigin;
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  const httpServer = createServer(app);
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: env.corsOrigin
      ? { origin: env.corsOrigin, credentials: true }
      : undefined,
  });

  const engine = new GameEngine(io, prisma, {
    revealMs: env.revealMs,
    leaderboardMs: env.leaderboardMs,
  });
  registerSocketHandlers(io, engine, prisma, env);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", createAuthRouter(prisma, env));
  app.use("/api", createQuizRouter(prisma, env, engine));

  // Serve the built SPA + fallback (only if the client has been built).
  const hasClient = existsSync(env.clientDist);
  if (hasClient) {
    app.use(express.static(env.clientDist));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.sendFile("index.html", { root: env.clientDist });
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .type("text/plain")
        .send("Quizmaster API is running. (Client build not found; run the client dev server.)");
    });
  }

  await new Promise<void>((resolve) => httpServer.listen(env.port, resolve));
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : env.port;

  const close = async (): Promise<void> => {
    engine.stop();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { httpServer, io, engine, port, close };
}
