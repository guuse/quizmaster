import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend dev port (server default from server/README.md).
const BACKEND = process.env.QUIZMASTER_BACKEND ?? "http://localhost:3000";

// Dev server proxies the REST API and the Socket.IO endpoint to the backend so the
// browser talks to a single origin (localhost:5173). This makes the session cookie
// "just work" (same-origin) and mirrors production, where the server serves client/dist.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/socket.io": { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
