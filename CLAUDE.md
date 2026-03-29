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
bun install          # Install all workspace dependencies
bun run dev          # Start all dev servers (turbo)
bun run build        # Build all packages
bun run check        # Run ultracite/biome lint+format check
bun run fix          # Auto-fix lint+format issues

# packages/db
cd packages/db
bun test             # Run query helper tests
bun run db:push      # Push schema to local dev DB
bun run db:seed      # Seed sample data
bun run db:generate  # Generate Drizzle migration
bun run db:studio    # Open Drizzle Studio

# apps/ingestion
cd apps/ingestion
bun test             # Run route tests
bun run dev          # Start Elysia dev server (port 3001)

# apps/web
cd apps/web
bun run dev          # Start Next.js dev server (port 3000)
```

## Key Conventions

- **Package manager**: Bun 1.3.9. Always use `bun` not npm/pnpm/yarn.
- **Module resolution**: ESNext/Bundler (not NodeNext). No `.js` extensions in imports.
- **Linting**: Ultracite (biome). Run `bun run check` before committing. Run `bun run fix` to auto-fix.
- **TypeScript**: Strict mode, `strictNullChecks: true`. All packages extend shared configs from `packages/typescript-config`.
- **Imports**: Use `@workspace/db` and `@workspace/ui` workspace aliases. Path aliases `@/*` for local files.
- **Formatting**: Biome handles formatting. Double quotes, no trailing commas in JSON, 2-space indent.

## Database

- **ORM**: Drizzle with libSQL
- **Local dev**: `file:local.db` in `packages/db/`. Web app needs `DATABASE_URL=file:../../packages/db/local.db` in `apps/web/.env.local`
- **Schema**: Single `metrics` table with unified schema (metric key, value, unit, date, source, metadata). Unique constraint on (metric, date).
- **Query helpers**: `getLatestValue`, `getTimeSeries`, `getLatestByCategory`, `bulkInsert` — all accept a `db` parameter for testability.

## Ingestion Service

- **Framework**: Elysia on Bun
- **Routes**: `GET /health`, `POST /collect/all`, `POST /collect/:source`
- **Collectors**: Each source gets a folder under `src/collectors/` with an `index.ts` orchestrator. Register in `src/collectors/registry.ts`.
- **Collector interface**: `() => Promise<CollectorResult[]>` — returns array of `{ metric, value, unit, date, source, metadata? }`.
- **XLSX downloads**: Use `downloadXlsxFiles()` from `src/lib/xlsx-downloader.ts` (Playwright-based, bypasses Cloudflare).
- **Date parsing**: Use `parseDateCell()` and `parseMonthCell()` from `src/lib/date-utils.ts`.

## Hosting

Railway (both web app and ingestion service). libSQL also on Railway.
