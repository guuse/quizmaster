/**
 * Room codes: 6 characters from an unambiguous alphabet (no 0/O, 1/I/L, etc.),
 * so a code read aloud or off a screen is unambiguous.
 */
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Player tokens / ids — opaque, URL-safe, unguessable. */
export function generateToken(bytes = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < bytes; i++) out += chars[randomInt(chars.length)];
  return out;
}
