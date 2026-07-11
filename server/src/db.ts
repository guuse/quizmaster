/**
 * Prisma client singleton. The schema (and its generated client) live at the repo
 * root under prisma/ — see prisma/schema.prisma. Durable tables only; live game
 * state never touches the database (it lives in the in-memory game engine).
 */
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
