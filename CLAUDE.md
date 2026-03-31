# NZ Ecom — Claude Code Guide

## Project Overview

NZ Economy Dashboard — a public landing page showing real-time NZ economic health indicators. Data-dense, Recharts-based dashboard displaying ~25 metrics across 4 categories (everyday costs, housing, employment, macro/financial).

## Architecture

Turborepo + Bun monorepo with 3 main workspaces:

- `apps/web` — Next.js 16 App Router dashboard (reads from DB, serves public UI)
- `apps/ingestion` — Bun + Elysia data collection service (scrapes/fetches data, writes to DB)
- `packages/db` — Shared Drizzle ORM + libSQL package (schema, queries, types)
- `packages/ui` — Shared shadcn/ui component library

Data flow: Data Sources → apps/ingestion (collectors) → packages/db (bulkInsert) → libSQL → packages/db (queries) → apps/web (Server Components) → browser

## Commands

```bash
# Root-level (run from project root)
bun install            # Install all workspace dependencies
bun run dev            # Start all dev servers (turbo)
bun run dev:web        # Start just the web app
bun run dev:ingestion  # Start just the ingestion service
bun run build          # Build all packages
bun run check          # Run ultracite/biome lint+format check
bun run fix            # Auto-fix lint+format issues
bun run collect        # Run ALL collectors (including groceries ~3min)
bun run collect:fast   # Run collectors except groceries (~6s)
bun run db:push        # Push schema to local dev DB
bun run db:seed        # Seed sample data
bun run db:studio      # Open Drizzle Studio

# Per-package commands
cd packages/db && bun test           # DB query helper tests
cd apps/ingestion && bun test        # Ingestion route tests
cd apps/ingestion && bun run collect # Run all collectors
```

## Environment

- `DATABASE_URL` — libSQL connection string. Set in `.env` at root for collectors, and in `apps/web/.env.local` for the web app.
- Local dev uses `file:packages/db/local.db` (root) or `file:../../packages/db/local.db` (from apps/web).

## Key Conventions

- **Package manager**: Bun 1.3.9. Always use `bun` not npm/pnpm/yarn.
- **Module resolution**: ESNext/Bundler (not NodeNext). No `.js` extensions in imports.
- **Linting**: Ultracite (biome). Run `bun run check` before committing. Run `bun run fix` to auto-fix.
- **TypeScript**: Strict mode, `strictNullChecks: true`. All packages extend shared configs from `packages/typescript-config`.
- **Imports**: Use `@workspace/db` and `@workspace/ui` workspace aliases. Path aliases `@/*` for local files.
- **Formatting**: Biome handles formatting. Double quotes, no trailing commas in JSON, 2-space indent.

## Database

- **ORM**: Drizzle with libSQL
- **Tables**: `metrics` (time-series data points) + `products` (individual grocery product prices)
- **Schema**: `metrics` has unified schema (metric key, value, unit, date, source, metadata). Unique on (metric, date). `products` tracks individual product prices with brand, store, size. Unique on (productId, store, date).
- **Query helpers**: `getLatestValue`, `getTimeSeries`, `getLatestByCategory`, `bulkInsert`, `insertProducts`, `getProductsByCategory` — all accept a `db` parameter for testability.

## Ingestion Service

- **Framework**: Elysia on Bun
- **Routes**: `GET /health`, `POST /collect/all`, `POST /collect/:source`
- **CLI**: `bun run collect` runs all collectors directly (no HTTP), `bun run collect:fast` skips slow grocery scrapers

### Collectors

| Collector | Metrics | Source | Method |
|-----------|---------|--------|--------|
| `rbnz` | NZD/USD, NZD/AUD, NZD/EUR, OCR, mortgages | RBNZ B1/B2/B20 XLSX | Playwright download |
| `stats-nz` | CPI, GDP, unemployment, wage growth, avg income | RBNZ M1/M5/M9 XLSX | Playwright download |
| `reinz` | House price median | REINZ press releases | HTML fetch + regex |
| `petrol` | Petrol 91/95/diesel | Gaspy (live) + MBIE (historical) | JSON API + CSV |
| `electricity` | Electricity $/kWh | EA regional prices CSV | CSV fetch |
| `minimum-wage` | Minimum wage | Static history | Hardcoded |
| `rent-vs-buy` | Rent-to-price ratio | Derived from DB | Calculation |
| `groceries` | Milk, eggs, bread, butter, cheese | Woolworths + Pak'nSave + New World | Playwright scraping |

### Adding a new collector

1. Create folder `src/collectors/{name}/index.ts`
2. Export default function matching `Collector` type: `() => Promise<CollectorResult[]>`
3. Register in `src/collectors/registry.ts`
4. Use shared utilities: `xlsx-parser.ts`, `xlsx-downloader.ts`, `date-utils.ts`

### Grocery scraper architecture

- `basket.ts` — Standardised basket items with search queries, size validation regexes, price ranges
- `brands.ts` — Brand extraction from 40+ known NZ grocery brands
- `woolworths.ts` — Chromium + stealth + page.evaluate for Woolworths NZ
- `foodstuffs-scraper.ts` — Shared Chromium + stealth scraper for Pak'nSave + New World
- `paknsave.ts` / `newworld.ts` — Thin wrappers over foodstuffs-scraper
- `index.ts` — Aggregator: runs all 3, writes products to `products` table, averages to `metrics`

## Development Environment — cmux

This project runs in **cmux** (terminal multiplexer with built-in browser). Always use cmux commands instead of opening URLs manually or using external browser tools.

```bash
# View the dev site
cmux browser open http://localhost:3000

# Check page content (accessibility snapshot — better than screenshot)
cmux browser snapshot

# Take a screenshot
cmux browser screenshot

# Navigate to a URL
cmux browser goto http://localhost:3000

# Wait for page load
cmux browser wait --load-state complete

# Snapshot specific element
cmux browser snapshot --selector ".metric-card"

# Open browser in a split pane
cmux new-pane --type browser --url http://localhost:3000

# Check current cmux layout
cmux identify --json
cmux list-panes
```

**When verifying frontend changes:** Use `cmux browser open` + `cmux browser snapshot` to check the rendered page. Don't ask the user to open URLs or send screenshots.

## Frontend Structure (apps/web)

```
app/
  page.tsx                — thin shell composing section components
  layout.tsx              — root layout (Playfair Display, Noto Sans, Geist Mono)
components/
  theme-provider.tsx      — dark mode toggle (app-specific)
  sections/               — async Server Components (fetch own data)
    masthead.tsx, ticker.tsx, overview.tsx, *-deep-dive.tsx, footer.tsx
  charts/                 — "use client" Recharts wrappers
    area-chart.tsx, multi-line-chart.tsx
lib/
  data.ts                 — formatters (formatValue, computeChange, etc.)
  queries.ts              — centralised DB fetching functions
```

**UI primitives** live in `@workspace/ui` (sparkline, metric-card, compact-row, marquee, section-header). Import as `@workspace/ui/components/sparkline`.

## Hosting

Railway (both web app and ingestion service). libSQL also on Railway.
