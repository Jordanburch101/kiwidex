# ── Stage 1: Prune monorepo to only ingestion + its dependencies ──
FROM oven/bun:1.3.9-slim AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune ingestion --docker

# ── Stage 2: Install dependencies ──
FROM oven/bun:1.3.9-slim AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile

# ── Stage 3: Build (copy source on top of installed deps) ──
FROM oven/bun:1.3.9-slim AS builder
WORKDIR /app
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .

# Install Playwright browsers (Chromium + Firefox for scrapers)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      xdg-utils \
      wget && \
    bunx playwright install chromium firefox && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ── Stage 4: Production runner ──
FROM oven/bun:1.3.9-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install only browser runtime deps (no build tools)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      xdg-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

# Copy app source + deps + browsers
COPY --from=builder --chown=app:app /app/ .
COPY --from=builder --chown=app:app /ms-playwright /ms-playwright

USER app
EXPOSE 3001
CMD ["bun", "apps/ingestion/src/index.ts"]
