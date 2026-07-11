/**
 * Production entrypoint: `node dist/index.js`. Loads env, boots the server, and wires
 * graceful shutdown. DB migrations are run out-of-band on container start (see the
 * Dockerfile / deploy manifests) via `prisma migrate deploy`.
 */
import { loadEnv } from "./env.js";
import { startServer } from "./app.js";
import { disconnectPrisma } from "./db.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const server = await startServer(env);
  // eslint-disable-next-line no-console
  console.log(`[quizmaster] listening on :${server.port} (devAuth=${env.devAuth}, fakeQuiz=${env.fakeQuiz})`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[quizmaster] received ${signal}, shutting down…`);
    await server.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main().catch((err) => {
  console.error("[quizmaster] fatal:", err);
  process.exit(1);
});
