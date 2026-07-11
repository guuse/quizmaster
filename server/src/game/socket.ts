/**
 * Socket.IO wiring. Maps the typed ClientToServerEvents onto the game engine. The
 * creator is identified by the session cookie carried on the socket handshake: if the
 * connecting user owns the quiz, their player is flagged as the creator.
 */
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@quizmaster/shared";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../env.js";
import { getUserFromCookie } from "../auth/session.js";
import type { GameEngine } from "./engine.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(
  io: IO,
  engine: GameEngine,
  prisma: PrismaClient,
  env: Env,
): void {
  io.on("connection", (socket: GameSocket) => {
    socket.on("room:join", async (payload, ack) => {
      let userId: string | null = null;
      try {
        const user = await getUserFromCookie({ prisma, env }, socket.handshake.headers.cookie);
        userId = user?.id ?? null;
      } catch {
        userId = null;
      }
      engine.handleJoin(socket, payload, userId, ack);
    });

    socket.on("game:start", (ack) => {
      engine.handleStart(socket, ack);
    });

    socket.on("answer:submit", (payload, ack) => {
      engine.handleAnswer(socket, payload, ack);
    });

    socket.on("room:resync", (ack) => {
      engine.handleResync(socket, ack);
    });

    socket.on("disconnect", () => {
      engine.handleDisconnect(socket);
    });
  });
}
