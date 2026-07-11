import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@quizmaster/shared";

/** socket.io generics are <ListenEvents, EmitEvents> = server→client, client→server. */
export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket per room page. Same-origin (dev proxy / prod static), so `withCredentials`
 * carries the creator's session cookie on the handshake — that's how the server knows
 * which connection is the quiz owner. We don't autoConnect; the RoomProvider controls it.
 */
export function createSocket(): QuizSocket {
  return io({
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 400,
    reconnectionDelayMax: 4000,
  });
}
