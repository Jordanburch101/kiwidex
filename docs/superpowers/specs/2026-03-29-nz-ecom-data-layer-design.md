# NZ Ecom — Data Layer Design

> Single-page dashboard showing NZ economic health indicators.
> This spec covers the data layer: schema, ingestion, and data-fetching architecture.
> Frontend design (layout, charts, visual style) is deferred to a future spec.

## Overview

A public, read-heavy landing page displaying ~25 economic metrics across 4 categories.
Data is collected from a mix of public APIs, CSV exports, and web scraping, stored in libSQL,
and served via Next.js cache components for minimal DB load.

## Metrics

### Everyday Costs
- `petrol_91` — 91 octane, NZD/litre
- `petrol_95` — 95 octane, NZD/litre
- `petrol_diesel` — Diesel, NZD/litre
- `milk` — 2L standard milk, NZD
- `eggs` — Dozen size 7, NZD
- `bread` — White loaf, NZD
- `butter` — 500g block, NZD
- `cheese` — 1kg mild, NZD
- `rent_national` — Median weekly rent, NZD/week
- `electricity` — Average residential, NZD/kWh

### Housing
- `house_price_median` — National median house price, NZD
- `mortgage_floating` — Floating mortgage rate, percent
- `mortgage_1yr` — 1-year fixed rate, percent
- `mortgage_2yr` — 2-year fixed rate, percent
- `rent_vs_buy` — Rent-to-price ratio

### Employment & Income
- `unemployment` — Unemployment rate, percent
- `median_income` — Median annual income, NZD
- `wage_growth` — Annual wage growth, percent
- `minimum_wage` — Current minimum wage, NZD/hour

### Macro / Financial
- `ocr` — Official Cash Rate, percent
- `cpi` — Consumer Price Index annual change, percent
- `nzd_usd` — NZD to USD exchange rate
- `nzd_aud` — NZD to AUD exchange rate
- `nzd_eur` — NZD to EUR exchange rate
- `gdp_growth` — GDP quarterly growth, percent

## Architecture

```
Monorepo (Turborepo + Bun)
├── apps/
│   ├── web/           — Next.js 16 dashboard (reads from DB)
│   └── ingestion/     — Bun + Elysia data collection service
├── packages/
│   ├── ui/            — Shared UI components (exists)
│   ├── db/            — Drizzle schema, client, migrations, queries
│   ├── typescript-config/  — Shared TS configs (exists)
│   └── eslint-config/     — Shared ESLint configs (exists)
```

### Data flow

```
Data Sources (APIs, CSVs, scraping)
    ↓
apps/ingestion (Elysia collectors)
    ↓
packages/db (Drizzle → bulkInsert)
    ↓
libSQL on Railway
    ↓
packages/db (query helpers)
    ↓
apps/web (Server Components + cache components)
    ↓
Browser (public, no auth)
```

## Package: `packages/db`

### Schema

Single `metrics` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer, PK | Auto-increment |
| `metric` | text, not null | Metric key (e.g., `petrol_91`, `unemployment`) |
| `value` | real, not null | Numeric value |
| `unit` | text, not null | Unit: `nzd`, `percent`, `ratio`, `nzd_per_litre`, `nzd_per_kwh`, `nzd_per_week`, `nzd_per_hour` |
| `date` | text, not null | ISO date the value applies to (`2026-03-29`) |
| `source` | text | Data source identifier |
| `metadata` | text | JSON blob for extra context (region, brand, sub-type) |
| `created_at` | text | Insertion timestamp |

**Indexes:**
- Composite index on `(metric, date)` for time-series queries
- Unique constraint on `(metric, date)` to prevent duplicates (upsert on conflict)

### Exported query helpers

- `getLatestValue(metric)` — Most recent data point for a metric
- `getTimeSeries(metric, from, to)` — Historical values between dates
- `getLatestByCategory(category)` — All latest values for a category
- `bulkInsert(dataPoints[])` — Upsert array of data points on `(metric, date)`

### Metric type enum

A TypeScript const/enum defining all valid metric keys, categories, and display metadata (label, unit, category). Shared by both apps for type safety.

## App: `apps/ingestion`

### Stack
- Bun runtime
- Elysia web framework
- Playwright (for scraping sources)
- Cheerio (for simpler HTML parsing)
- CSV parser (for Stats NZ exports)
- `@workspace/db` for writes

### Structure

```
apps/ingestion/src/
  index.ts                — Elysia app with routes
  collectors/
    index.ts              — Registry, common collector type
    petrol/
      index.ts            — Orchestrator
      aa.ts               — AA fuel prices
      z-energy.ts         — Z Energy
      mbie.ts             — MBIE weekly monitoring (CSV)
    groceries/
      index.ts            — Orchestrator
      countdown.ts        — Countdown scraping
      paknsave.ts         — Pak'nSave scraping
    rbnz/
      index.ts            — OCR, mortgage rates, exchange rates
    stats-nz/
      index.ts            — CPI, unemployment, GDP, income, house prices
    rent/
      index.ts            — Tenancy services / Trade Me
    electricity/
      index.ts            — MBIE or EMI data
  lib/
    collector.ts          — Base collector interface
    scraper.ts            — Shared Playwright/fetch utilities
```

### Collector interface

Every collector folder exports a function conforming to:

```typescript
type CollectorResult = {
  metric: MetricKey
  value: number
  unit: string
  date: string
  source: string
  metadata?: Record<string, unknown>
}

type Collector = () => Promise<CollectorResult[]>
```

### Elysia routes

- `POST /collect/:source` — Trigger a specific collector by name
- `POST /collect/all` — Run all collectors sequentially
- `GET /health` — Health check

### Deployment

- Railway service with cron jobs hitting the collect endpoints
- Schedules determined per-metric during implementation
- Direct libSQL writes (no HTTP middleman to the DB)

## App: `apps/web`

### Data fetching

- Server Components import query helpers from `@workspace/db` directly
- Cache components (`'use cache'`) wrap data-fetching with `cacheLife` tuned per category:
  - Short (hours): exchange rates, petrol
  - Medium (daily): groceries, rent, electricity
  - Long (weekly): GDP, unemployment, CPI, income, house prices
- `cacheTag` per metric for targeted revalidation

### Revalidation

Ingestion service hits `POST /api/revalidate?tag={metric}` on the web app after writing new data.
This busts the cache for affected metrics without polling.
Both services are on Railway, so the ingestion service can reach the web app via Railway's internal networking.

### Initial frontend (placeholder)

Minimal functional UI to verify data pipeline:
- Plain text/table display of all metrics grouped by category
- Current value + date for each metric
- No charts, no styling beyond base shadcn — just proof the data flows end-to-end

Full dashboard design (dense layout, Recharts, sparklines, historical views) deferred to a separate spec.

## Hosting

- **Web app:** Railway
- **Ingestion service:** Railway (separate service)
- **Database:** libSQL on Railway

## Out of scope (for this spec)

- Frontend design / visual style / chart selection
- Authentication (fully public)
- Net migration, consumer confidence, fuel tax breakdown
- Real-time WebSocket updates
- Mobile-specific responsive design
