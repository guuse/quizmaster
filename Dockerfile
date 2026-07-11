# Quizmaster — multi-stage build.
#   1. install workspace deps
#   2. build shared -> client -> server (server output serves the client build)
#   3. slim runtime image running `node server/dist/index.js`
#
# The Prisma client is generated in the build stage; migrations run on container start
# via `prisma migrate deploy` (see CMD).

# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# openssl is needed for Prisma's engine during generate.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install deps first (better layer caching). Copy every workspace manifest.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

# Source.
COPY prisma ./prisma
COPY shared ./shared
COPY client ./client
COPY server ./server

# Generate the Prisma client, then build shared -> client -> server.
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build -w shared \
    && npm run build -w client \
    && npm run build -w server

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# node_modules (incl. the generated Prisma client + the prisma CLI for migrate deploy).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Built workspaces.
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

# Apply pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node server/dist/index.js"]
