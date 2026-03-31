# ── Stage 1: Prune monorepo to only web + its dependencies ──
FROM oven/bun:1.3.9-slim AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune web --docker

# ── Stage 2: Install dependencies ──
FROM oven/bun:1.3.9-slim AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

# ── Stage 3: Build ──
FROM oven/bun:1.3.9-slim AS builder
WORKDIR /app
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run build --filter=web

# ── Stage 4: Production runner (Node.js for Next.js standalone) ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone server + static assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
