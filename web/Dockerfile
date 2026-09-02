# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 (a devDependency, used only by the one-off data-migration
# script) needs a native build toolchain to install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci \
    && apt-get purge -y python3 make g++ && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# The Prisma query engine and generated client are already bundled into
# .next/standalone by Next.js's own output-file tracing (Prisma is
# special-cased there), so no extra copying is needed to talk to the DB.
# Migrations are applied to prisma/dev.db before it's committed/mounted in
# (see web/README.md) rather than re-run on every container start, since
# bundling the standalone `prisma` CLI here to run `migrate deploy` pulls in
# files Next's tracing doesn't capture.

EXPOSE 3000

CMD ["node", "server.js"]
