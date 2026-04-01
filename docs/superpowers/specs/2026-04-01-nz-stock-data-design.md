# NZ Stock Market Data — Design Spec

## Summary

Add NZ stock market data to The Kiwidex dashboard: the NZX 50 index as a headline economic indicator, plus 4 bellwether NZ stocks (Air NZ, FPH, Meridian, Fletcher Building). Data sourced from Yahoo Finance, displayed in a dedicated "Markets" deep-dive section using Lightweight Charts (TradingView) for financial charting.

## Data Source

**Yahoo Finance** via the `yahoo-finance2` npm package.

- No API key required
- Provides daily OHLC (open/high/low/close) + volume
- NZX coverage via `.NZ` ticker suffix
- 2+ years of historical data available

### Tickers

| Display Name | Yahoo Ticker | Relevance |
|-------------|-------------|-----------|
| NZX 50 Index | `^NZ50` | Headline market health |
| Air New Zealand | `AIR.NZ` | Tourism, travel costs |
| Fisher & Paykel Healthcare | `FPH.NZ` | NZ's largest company, healthcare exports |
| Meridian Energy | `MEL.NZ` | Ties to electricity price data |
| Fletcher Building | `FBU.NZ` | Construction, ties to housing data |

## Database Schema

### New `stocks` table (`packages/db/src/schema.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | auto-increment |
| `ticker` | text | e.g. `^NZ50`, `AIR.NZ` |
| `date` | text | ISO date (YYYY-MM-DD) |
| `open` | real | |
| `high` | real | |
| `low` | real | |
| `close` | real | |
| `volume` | integer | |
| `createdAt` | text | ISO timestamp |

**Unique constraint** on `(ticker, date)` — upsert on conflict, same pattern as `metrics` and `products`.

### Metrics mirroring

The NZX 50 close price is also written to the `metrics` table:

- **Key:** `nzx50-close`
- **Category:** `macro-financial`
- **Unit:** `index-points`
- **Sentiment:** `up_is_good`

This allows the NZX 50 to appear in the ticker marquee and overview cards with zero special-casing.

The 4 bellwether stocks are **not** mirrored to metrics — they only appear in the dedicated Markets section.

### New metric definition (`packages/db/src/metrics.ts`)

```
nzx50-close: {
  label: "NZX 50",
  category: "macro-financial",
  unit: "index-points",
  sentiment: "up_is_good",
  frequency: "daily"
}
```

## Collector

### Location

`apps/ingestion/src/collectors/stocks/index.ts`

### Dependencies

- `yahoo-finance2` (npm package)

### Logic

1. Define ticker list: `['^NZ50', 'AIR.NZ', 'FPH.NZ', 'MEL.NZ', 'FBU.NZ']`
2. For each ticker, call `yahoo-finance2` `historical()` with daily interval
3. **First run (backfill):** Fetch 2 years of history
4. **Subsequent runs:** Fetch last 7 days (overlap handles weekends/holidays; upsert deduplicates)
5. Write OHLC + volume rows to `stocks` table via new `insertStocks()` query helper
6. Mirror NZX 50 close to `metrics` table via existing `bulkInsert()`
7. Return `CollectorResult[]` matching the standard collector interface

### Backfill detection

Query the `stocks` table for existing rows for `^NZ50`. If none exist, fetch 2 years. Otherwise, fetch 7 days.

### Error handling

If a single ticker fails, log the error and continue with the remaining tickers. Same resilience pattern as other collectors.

### Registration

Added to `apps/ingestion/src/collectors/registry.ts` as `stocks`. Included in both `collect` and `collect:fast` groups — Yahoo Finance API calls are fast (no browser needed).

### Update frequency

Daily, after NZX market close (4:45pm NZST). Runs alongside other daily collectors.

## Query Layer

### New query helpers (`packages/db/src/queries.ts`)

- **`getStockTimeSeries(db, ticker, from?, to?)`** — returns OHLC + volume rows ordered by date. Used by Lightweight Charts for candlestick rendering.
- **`getLatestStockQuote(db, ticker)`** — returns the most recent row for a ticker (close price + date).
- **`getAllLatestQuotes(db)`** — returns the latest row for all 5 tickers in a single query. Used for the bellwether cards and section header.

### New computed queries (`apps/web/lib/queries.ts`)

- **`getMarketData()`** — orchestrates all data for the Markets section:
  - NZX 50 full OHLC timeseries (hero candlestick chart)
  - 4 bellwether close-price timeseries (sparkline area charts)
  - Latest quotes for all 5 tickers with daily and 30-day % change
  - Cached with `tags: ["metrics"]`, same as all other query functions

## Frontend

### New files

| File | Type | Purpose |
|------|------|---------|
| `apps/web/components/sections/markets-deep-dive.tsx` | Server Component | Async data fetcher + layout |
| `apps/web/components/charts/stock-chart.tsx` | Client Component (`"use client"`) | Lightweight Charts wrapper |

### Dependencies

- `lightweight-charts` (TradingView open-source library)
- `lightweight-charts-react-wrapper` (React bindings)

### Section layout

```
Markets Deep-Dive
+-- Section header ("Markets" with NZX 50 latest value + change pill)
+-- Hero: NZX 50 candlestick chart (Lightweight Charts)
|   +-- Time range selector (1m / 3m / 6m / 1y / 2y)
+-- Bellwether row: 4 cards in a responsive grid
    +-- Air NZ: close price, % change pill, area sparkline
    +-- FPH: same
    +-- Meridian: same
    +-- Fletcher Building: same
```

### Lightweight Charts theming

Charts are themed to match the existing design system (warm stone/neutral palette with teal chart colours):

- **Light mode:** White background (`--background`), stone-grey gridlines (`--border`), teal candlestick up colour (`--chart-1`), red down colour (`--destructive`). Text uses `--foreground`.
- **Dark mode:** Reads from `.dark` CSS variables — dark stone background, same chart colour tokens.
- Bellwether sparklines use `--chart-2` through `--chart-5` for visual distinction.
- Crosshair and tooltips styled to match `--card`/`--popover` tokens.

### Page placement

In `apps/web/app/page.tsx`: inserted after `CurrencyDeepDive`, before `SponsorCTA`. Markets is the last deep-dive section.

### Ticker integration

NZX 50 appears in the ticker marquee automatically — `getTickerData()` already pulls from the `metrics` table, and the collector mirrors the close price there.

## Non-goals

- Intraday/real-time data (daily close is sufficient)
- Sector indices (too abstract for the target audience)
- Trading features (buy/sell, portfolio tracking)
- More than 4 bellwether stocks (keep it focused)
