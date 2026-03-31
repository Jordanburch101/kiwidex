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
# Build prerendering uses the public libsql URL (private network unreachable during build).
# At runtime, DATABASE_URL is overridden by Railway service variables (private network).
# These ENVs only exist in the builder stage — the runner starts from a clean base image.
ARG DATABASE_AUTH_TOKEN
ENV DATABASE_URL=https://libsql-production-c788.up.railway.app
ENV DATABASE_AUTH_TOKEN=$DATABASE_AUTH_TOKEN
RUN bun run build --filter=web

# ── Stage 4: Production runner (Bun) ──
FROM oven/bun:1.3.9-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 -g app app

# Copy standalone server, static assets, and public folder
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=1001:1001 /app/apps/web/public ./apps/web/public

# Bun resolves deps via node_modules/.bun — standalone tracer misses these
COPY --from=builder /app/node_modules/.bun ./node_modules/.bun
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img

USER app
EXPOSE 3000
CMD ["bun", "apps/web/server.js"]
