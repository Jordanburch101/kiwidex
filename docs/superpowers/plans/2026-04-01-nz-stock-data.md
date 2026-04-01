# NZ Stock Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NZX 50 index + 4 bellwether NZ stocks to The Kiwidex dashboard with a dedicated Markets deep-dive section using Lightweight Charts.

**Architecture:** New `stocks` table for OHLC data, Yahoo Finance collector via `yahoo-finance2`, NZX 50 close mirrored to `metrics` table for ticker/overview integration. Lightweight Charts (TradingView) renders candlestick + sparkline area charts in a new Markets section.

**Tech Stack:** yahoo-finance2, lightweight-charts, Drizzle ORM, libSQL, Next.js 16 App Router, Bun

**Spec:** `docs/superpowers/specs/2026-04-01-nz-stock-data-design.md`

---

### Task 1: Smoke-test yahoo-finance2 with Bun

Verify the library works under Bun and confirm exact NZX ticker symbols before building anything.

**Files:**
- (none — exploratory)

- [ ] **Step 1: Install yahoo-finance2 in ingestion workspace**

```bash
cd apps/ingestion && bun add yahoo-finance2
```

- [ ] **Step 2: Create a throwaway test script**

Create `apps/ingestion/test-yahoo.ts`:

```typescript
import yahooFinance from "yahoo-finance2";

const tickers = ["^NZ50", "AIR.NZ", "FPH.NZ", "MEL.NZ", "FBU.NZ"];

for (const ticker of tickers) {
  try {
    const result = await yahooFinance.historical(ticker, {
      period1: "2026-03-01",
      period2: "2026-04-01",
      interval: "1d",
    });
    console.log(`${ticker}: ${result.length} rows`);
    if (result[0]) {
      console.log(`  Sample:`, JSON.stringify(result[0]));
    }
  } catch (e) {
    console.error(`${ticker}: FAILED —`, e instanceof Error ? e.message : e);
  }
}
```

- [ ] **Step 3: Run the test script**

```bash
cd apps/ingestion && bun run test-yahoo.ts
```

Expected: Each ticker prints row count + sample row with `{ date, open, high, low, close, volume, adjClose }`. If any ticker fails or returns a different symbol format, note the correct one.

**If `^NZ50` doesn't work**, try `NZ50.NZ` or `^NZSE50FG` and update the ticker constant in all subsequent tasks.

- [ ] **Step 4: Delete the test script and commit**

```bash
rm apps/ingestion/test-yahoo.ts
git add apps/ingestion/package.json apps/ingestion/bun.lock
git commit -m "feat: add yahoo-finance2 dependency for stock data"
```

---

### Task 2: Add stocks table to DB schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add the stocks table definition**

Add after the `products` table definition (after line 66 in `packages/db/src/schema.ts`):

```typescript
export const stocks = sqliteTable(
  "stocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticker: text("ticker").notNull(),
    date: text("date").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: integer("volume"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("stock_ticker_date_uniq").on(table.ticker, table.date),
  ]
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat: add stocks table for OHLC market data"
```

---

### Task 3: Add NZX 50 metric definition + index unit

**Files:**
- Modify: `packages/db/src/metrics.ts`
- Modify: `apps/web/lib/data.ts`

- [ ] **Step 1: Add nzx_50 to METRIC_META**

In `packages/db/src/metrics.ts`, add before the closing `} as const satisfies Record<string, MetricMeta>;` (after the `gdp_growth` entry):

```typescript
  nzx_50: {
    label: "NZX 50",
    unit: "index",
    category: "macro_financial",
    description: "NZX 50 stock market index (daily close)",
  },
```

- [ ] **Step 2: Add index unit to formatValue**

In `apps/web/lib/data.ts`, add a new case in the `formatValue` switch before the `default`:

```typescript
    case "index":
      return value.toLocaleString("en-NZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/metrics.ts apps/web/lib/data.ts
git commit -m "feat: add NZX 50 metric definition and index unit formatter"
```

---

### Task 4: Add stock query helpers (test first)

**Files:**
- Modify: `packages/db/test/queries.test.ts`
- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Write failing tests for stock queries**

Add to the end of `packages/db/test/queries.test.ts` (before the final closing `});`), after importing the new functions and schema:

First, update the imports at the top of the file. Add `stocks` to the schema import, and add `insertStocks`, `getStockTimeSeries`, `getLatestStockQuote`, `getAllLatestQuotes` to the queries import:

```typescript
import {
  bulkInsert,
  getLatestByCategory,
  getLatestValue,
  getTimeSeries,
  insertStocks,
  getStockTimeSeries,
  getLatestStockQuote,
  getAllLatestQuotes,
} from "../src/queries";
```

Then add a new `beforeAll` block inside the outer `describe` to create the stocks table (add it right after the existing `beforeAll` that creates the metrics table):

```typescript
  beforeAll(async () => {
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await testDb.run(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS stock_ticker_date_uniq ON stocks (ticker, date)
    `);
  });
```

Note: there are now two `beforeAll` blocks — that's fine, Bun runs them both in declaration order.

Then add the test suite at the bottom:

```typescript
  describe("stock queries", () => {
    beforeEach(async () => {
      await testDb.run(sql`DELETE FROM stocks`);
    });

    describe("insertStocks", () => {
      test("inserts OHLC rows", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12100,
            high: 12200,
            low: 12050,
            close: 12150,
            volume: 50000,
          },
        ]);
        const rows = await testDb.select().from(schema.stocks);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.close).toBe(12150);
      });

      test("upserts on duplicate ticker+date", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12100,
            high: 12200,
            low: 12050,
            close: 12150,
            volume: 50000,
          },
        ]);
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12100,
            high: 12250,
            low: 12050,
            close: 12200,
            volume: 55000,
          },
        ]);
        const rows = await testDb.select().from(schema.stocks);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.close).toBe(12200);
      });

      test("handles null volume", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12100,
            high: 12200,
            low: 12050,
            close: 12150,
            volume: null,
          },
        ]);
        const rows = await testDb.select().from(schema.stocks);
        expect(rows[0]?.volume).toBeNull();
      });
    });

    describe("getStockTimeSeries", () => {
      test("returns OHLC data ordered by date", async () => {
        await insertStocks(testDb, [
          {
            ticker: "AIR.NZ",
            date: "2026-03-26",
            open: 0.71,
            high: 0.73,
            low: 0.7,
            close: 0.72,
            volume: 1000000,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-27",
            open: 0.72,
            high: 0.74,
            low: 0.71,
            close: 0.73,
            volume: 900000,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-28",
            open: 0.73,
            high: 0.75,
            low: 0.72,
            close: 0.74,
            volume: 1100000,
          },
        ]);
        const results = await getStockTimeSeries(
          testDb,
          "AIR.NZ",
          "2026-03-27",
          "2026-03-28"
        );
        expect(results).toHaveLength(2);
        expect(results[0]?.date).toBe("2026-03-27");
        expect(results[1]?.close).toBe(0.74);
      });
    });

    describe("getLatestStockQuote", () => {
      test("returns most recent row for a ticker", async () => {
        await insertStocks(testDb, [
          {
            ticker: "FPH.NZ",
            date: "2026-03-27",
            open: 30,
            high: 31,
            low: 29.5,
            close: 30.5,
            volume: 200000,
          },
          {
            ticker: "FPH.NZ",
            date: "2026-03-28",
            open: 30.5,
            high: 31.5,
            low: 30,
            close: 31,
            volume: 250000,
          },
        ]);
        const result = await getLatestStockQuote(testDb, "FPH.NZ");
        expect(result).not.toBeNull();
        expect(result?.close).toBe(31);
        expect(result?.date).toBe("2026-03-28");
      });

      test("returns null for unknown ticker", async () => {
        const result = await getLatestStockQuote(testDb, "UNKNOWN.NZ");
        expect(result).toBeNull();
      });
    });

    describe("getAllLatestQuotes", () => {
      test("returns latest row for each ticker", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-27",
            open: 12000,
            high: 12100,
            low: 11900,
            close: 12050,
            volume: null,
          },
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12050,
            high: 12200,
            low: 12000,
            close: 12150,
            volume: null,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-28",
            open: 0.72,
            high: 0.74,
            low: 0.71,
            close: 0.73,
            volume: 1000000,
          },
        ]);
        const results = await getAllLatestQuotes(testDb);
        expect(results).toHaveLength(2);
        const nzx = results.find((r) => r.ticker === "^NZ50");
        expect(nzx?.close).toBe(12150);
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/db && bun test
```

Expected: FAIL — `insertStocks`, `getStockTimeSeries`, `getLatestStockQuote`, `getAllLatestQuotes` are not exported from `../src/queries`.

- [ ] **Step 3: Implement stock query helpers**

Add to `packages/db/src/queries.ts`. First, add `stocks` to the schema import at line 5:

```typescript
import { articles, metrics, products, scraperRuns, stocks, summaries } from "./schema";
```

Then add a new type and the query functions at the bottom of the file:

```typescript
// --- Stock queries ---

export type NewStock = Omit<typeof stocks.$inferInsert, "id" | "createdAt">;

export async function insertStocks(db: Db, items: NewStock[]) {
  if (items.length === 0) {
    return;
  }

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await db
      .insert(stocks)
      .values(chunk)
      .onConflictDoUpdate({
        target: [stocks.ticker, stocks.date],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
          createdAt: new Date().toISOString(),
        },
      });
  }
}

export async function getStockTimeSeries(
  db: Db,
  ticker: string,
  from: string,
  to: string
) {
  return db
    .select()
    .from(stocks)
    .where(
      and(
        eq(stocks.ticker, ticker),
        gte(stocks.date, from),
        lte(stocks.date, to)
      )
    )
    .orderBy(stocks.date);
}

export async function getLatestStockQuote(db: Db, ticker: string) {
  const rows = await db
    .select()
    .from(stocks)
    .where(eq(stocks.ticker, ticker))
    .orderBy(desc(stocks.date))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllLatestQuotes(db: Db) {
  const allRows = await db
    .select()
    .from(stocks)
    .orderBy(desc(stocks.date));

  const latest = new Map<string, typeof stocks.$inferSelect>();
  for (const row of allRows) {
    if (!latest.has(row.ticker)) {
      latest.set(row.ticker, row);
    }
  }

  return Array.from(latest.values());
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/db && bun test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries.ts packages/db/test/queries.test.ts
git commit -m "feat: add stock OHLC query helpers with tests"
```

---

### Task 5: Export new stock types and functions from DB package

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add stock exports**

In `packages/db/src/index.ts`, add `insertStocks`, `getStockTimeSeries`, `getLatestStockQuote`, `getAllLatestQuotes`, and `NewStock` to the queries export block:

```typescript
export {
  bulkInsert,
  getLastSuccessDate,
  getLatestArticles,
  getLatestByCategory,
  getLatestRuns,
  getLatestSummary,
  getLatestValue,
  getProductsByCategory,
  getStaleCollectors,
  getTimeSeries,
  insertArticles,
  insertProducts,
  insertScraperRun,
  insertStocks,
  insertSummary,
  getAllLatestQuotes,
  getLatestStockQuote,
  getStockTimeSeries,
  type NewArticle,
  type NewProduct,
  type NewScraperRun,
  type NewStock,
  type ScraperRun,
} from "./queries";
```

Add `stocks` to the schema export:

```typescript
export { articles, metrics, products, scraperRuns, stocks, summaries } from "./schema";
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat: export stock query helpers from db package"
```

---

### Task 6: Push schema to dev DB

**Files:**
- (none — command only)

- [ ] **Step 1: Push the schema**

```bash
bun run db:push
```

Expected: `stocks` table created in the local dev database.

---

### Task 7: Build the stocks collector

**Files:**
- Create: `apps/ingestion/src/collectors/stocks/index.ts`

- [ ] **Step 1: Create the collector**

Create `apps/ingestion/src/collectors/stocks/index.ts`:

```typescript
import { bulkInsert, db, insertStocks, type NewStock } from "@workspace/db";
import type { CollectorResult } from "../types";

const TICKERS = [
  { symbol: "^NZ50", metric: "nzx_50" as const },
  { symbol: "AIR.NZ", metric: null },
  { symbol: "FPH.NZ", metric: null },
  { symbol: "MEL.NZ", metric: null },
  { symbol: "FBU.NZ", metric: null },
] as const;

const SOURCE = "https://finance.yahoo.com";
const BACKFILL_DAYS = 730; // ~2 years
const RECENT_DAYS = 7;

async function hasExistingData(): Promise<boolean> {
  const { getLatestStockQuote } = await import("@workspace/db");
  const latest = await getLatestStockQuote(db, "^NZ50");
  return latest !== null;
}

export default async function collectStocks(): Promise<CollectorResult[]> {
  const yahooFinance = (await import("yahoo-finance2")).default;

  const hasData = await hasExistingData();
  const daysBack = hasData ? RECENT_DAYS : BACKFILL_DAYS;
  const period1 = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;
  const period2 = new Date().toISOString().split("T")[0]!;

  console.log(
    `[stocks] ${hasData ? "Incremental" : "Backfill"} fetch: ${period1} → ${period2}`
  );

  const allStockRows: NewStock[] = [];
  const metricResults: CollectorResult[] = [];

  for (const { symbol, metric } of TICKERS) {
    try {
      const history = await yahooFinance.historical(symbol, {
        period1,
        period2,
        interval: "1d",
      });

      const rows: NewStock[] = history.map((row) => ({
        ticker: symbol,
        date: new Date(row.date).toISOString().split("T")[0]!,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume ?? null,
      }));

      allStockRows.push(...rows);

      // Mirror NZX 50 close to metrics table
      if (metric) {
        for (const row of rows) {
          metricResults.push({
            metric,
            value: row.close,
            unit: "index",
            date: row.date,
            source: SOURCE,
          });
        }
      }

      console.log(`  ${symbol}: ${rows.length} rows`);
    } catch (e) {
      console.error(
        `  ${symbol}: FAILED — ${e instanceof Error ? e.message : e}`
      );
    }
  }

  // Write OHLC data to stocks table
  if (allStockRows.length > 0) {
    await insertStocks(db, allStockRows);
    console.log(`[stocks] ${allStockRows.length} total OHLC rows written`);
  }

  // Return metric results for bulkInsert in collect-all.ts
  return metricResults;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ingestion/src/collectors/stocks/index.ts
git commit -m "feat: add stocks collector using yahoo-finance2"
```

---

### Task 8: Register collector and run

**Files:**
- Modify: `apps/ingestion/src/collectors/registry.ts`

- [ ] **Step 1: Add stocks to registry**

In `apps/ingestion/src/collectors/registry.ts`, add the import:

```typescript
import collectStocks from "./stocks/index";
```

Add to the registry object:

```typescript
  stocks: collectStocks,
```

- [ ] **Step 2: Run the collector**

```bash
cd apps/ingestion && bun run collect -- --skip=groceries,summary,news
```

Expected: The stocks collector runs, fetches 2 years of backfill data, writes to the `stocks` table, and mirrors NZX 50 to metrics.

- [ ] **Step 3: Verify data is in the DB**

```bash
bun run db:studio
```

Check: `stocks` table has rows for all 5 tickers. `metrics` table has `nzx_50` entries.

- [ ] **Step 4: Commit**

```bash
git add apps/ingestion/src/collectors/registry.ts
git commit -m "feat: register stocks collector in registry"
```

---

### Task 9: Install lightweight-charts in web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the package**

```bash
cd apps/web && bun add lightweight-charts
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock
git commit -m "feat: add lightweight-charts dependency"
```

Note: if there's a root-level `bun.lock` instead of per-workspace, commit that instead.

---

### Task 10: Add stock colors and ticker sentiment

**Files:**
- Modify: `apps/web/lib/colors.ts`
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Add STOCK_COLORS to colors.ts**

Add at the bottom of `apps/web/lib/colors.ts`:

```typescript
/** Stock market series */
export const STOCK_COLORS = {
  nzx_50: DATA.blue,
  air_nz: DATA.burntOrange,
  fph: DATA.purple,
  mel: DATA.teal,
  fbu: DATA.gold,
} as const;
```

- [ ] **Step 2: Add NZX 50 ticker sentiment**

In `apps/web/lib/queries.ts`, add to the `TICKER_SENTIMENT` object:

```typescript
  nzx_50: "up_is_good",
```

- [ ] **Step 3: Add NZX 50 to ticker metrics list**

In `apps/web/lib/queries.ts`, in the `_getTickerData` function, add to the `tickerMetrics` array (after the EUR entry):

```typescript
    { metric: "nzx_50" as MetricKey, label: "NZX 50" },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/colors.ts apps/web/lib/queries.ts
git commit -m "feat: add stock colors and NZX 50 to ticker"
```

---

### Task 11: Add market data query function

**Files:**
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Add imports for stock queries**

At the top of `apps/web/lib/queries.ts`, update the `@workspace/db` import to include the stock queries:

```typescript
import {
  getLatestArticles,
  getLatestSummary,
  getLatestValue,
  getStockTimeSeries,
  getAllLatestQuotes,
  getTimeSeries,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
```

- [ ] **Step 2: Add the market data query**

Add before the cached exports section (before `const CACHE_OPTS`):

```typescript
async function _getMarketData() {
  const from = getAllTimeStart();
  const to = getToday();

  const [nzx50Ohlc, airNzSeries, fphSeries, melSeries, fbuSeries, quotes] =
    await Promise.all([
      getStockTimeSeries(db, "^NZ50", from, to),
      getStockTimeSeries(db, "AIR.NZ", from, to),
      getStockTimeSeries(db, "FPH.NZ", from, to),
      getStockTimeSeries(db, "MEL.NZ", from, to),
      getStockTimeSeries(db, "FBU.NZ", from, to),
      getAllLatestQuotes(db),
    ]);

  return {
    nzx50: nzx50Ohlc.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    })),
    bellwethers: {
      "AIR.NZ": airNzSeries.map((r) => ({ date: r.date, value: r.close })),
      "FPH.NZ": fphSeries.map((r) => ({ date: r.date, value: r.close })),
      "MEL.NZ": melSeries.map((r) => ({ date: r.date, value: r.close })),
      "FBU.NZ": fbuSeries.map((r) => ({ date: r.date, value: r.close })),
    },
    quotes: quotes.map((q) => ({
      ticker: q.ticker,
      close: q.close,
      date: q.date,
    })),
  };
}
```

- [ ] **Step 3: Add cached export**

Add with the other cached exports:

```typescript
export const getMarketData = unstable_cache(
  _getMarketData,
  ["market"],
  CACHE_OPTS
);
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && bun run build
```

Expected: Build succeeds (no type errors from the new query).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/queries.ts
git commit -m "feat: add getMarketData query for markets section"
```

---

### Task 12: Build the Lightweight Charts client component

**Files:**
- Create: `apps/web/components/charts/stock-chart.tsx`

- [ ] **Step 1: Create the stock chart component**

Create `apps/web/components/charts/stock-chart.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type AreaData,
  type BusinessDay,
  ColorType,
} from "lightweight-charts";

function toBusinessDay(dateStr: string): BusinessDay {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

interface CandlestickChartProps {
  data: { date: string; open: number; high: number; low: number; close: number }[];
  height?: number;
  upColor?: string;
  downColor?: string;
}

export function CandlestickChart({
  data,
  height = 300,
  upColor = "var(--chart-1)",
  downColor = "var(--destructive)",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "var(--foreground)",
        fontFamily: "var(--font-geist-mono)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "var(--border)" },
        horzLines: { color: "var(--border)" },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "var(--card)" },
        horzLine: { labelBackgroundColor: "var(--card)" },
      },
      rightPriceScale: {
        borderColor: "var(--border)",
      },
      timeScale: {
        borderColor: "var(--border)",
        timeVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    const candlestickData: CandlestickData[] = data.map((d) => ({
      time: toBusinessDay(d.date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(candlestickData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height, upColor, downColor]);

  return <div ref={containerRef} />;
}

interface SparklineAreaProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
}

export function SparklineArea({
  data,
  height = 60,
  color = "var(--chart-1)",
}: SparklineAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScale: false,
      handleScroll: false,
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: color,
      topColor: `${color}33`,
      bottomColor: `${color}05`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const areaData: AreaData[] = data.map((d) => ({
      time: toBusinessDay(d.date),
      value: d.value,
    }));

    areaSeries.setData(areaData);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [data, height, color]);

  return <div ref={containerRef} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/charts/stock-chart.tsx
git commit -m "feat: add Lightweight Charts candlestick and sparkline components"
```

---

### Task 13: Build the Markets deep-dive section

**Files:**
- Create: `apps/web/components/sections/markets-charts.tsx`
- Create: `apps/web/components/sections/markets-deep-dive.tsx`

- [ ] **Step 1: Create the client chart wrapper**

Create `apps/web/components/sections/markets-charts.tsx`:

```typescript
"use client";

import { useState } from "react";
import { CandlestickChart, SparklineArea } from "@/components/charts/stock-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { STOCK_COLORS } from "@/lib/colors";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface QuoteInfo {
  ticker: string;
  close: number;
  date: string;
}

const BELLWETHER_META: Record<string, { label: string; color: string }> = {
  "AIR.NZ": { label: "Air NZ", color: STOCK_COLORS.air_nz },
  "FPH.NZ": { label: "Fisher & Paykel", color: STOCK_COLORS.fph },
  "MEL.NZ": { label: "Meridian", color: STOCK_COLORS.mel },
  "FBU.NZ": { label: "Fletcher Building", color: STOCK_COLORS.fbu },
};

interface MarketsChartsProps {
  nzx50: OhlcPoint[];
  bellwethers: Record<string, { date: string; value: number }[]>;
  quotes: QuoteInfo[];
}

export function MarketsCharts({ nzx50, bellwethers, quotes }: MarketsChartsProps) {
  const [range, setRange] = useState<TimeRange>("1y");

  const filteredNzx50 = filterByRange(nzx50, range);

  return (
    <>
      <div className="mb-6 flex justify-end">
        <TimeRangeSelector
          onChange={setRange}
          ranges={["90d", "1y", "5y", "all"]}
          value={range}
        />
      </div>

      <CandlestickChart data={filteredNzx50} height={300} />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(BELLWETHER_META).map(([ticker, { label, color }]) => {
          const seriesData = bellwethers[ticker] ?? [];
          const filteredData = filterByRange(seriesData, range);
          const quote = quotes.find((q) => q.ticker === ticker);
          const prevClose =
            filteredData.length >= 2
              ? filteredData[filteredData.length - 2]?.value
              : null;
          const change =
            quote && prevClose
              ? ((quote.close - prevClose) / prevClose) * 100
              : null;

          return (
            <div
              className="rounded-lg border border-[#e5e0d5] bg-white p-3"
              key={ticker}
            >
              <p className="font-medium text-[#2a2520] text-xs">{label}</p>
              <p className="mt-0.5 font-mono text-lg text-[#2a2520]">
                ${quote?.close.toFixed(2) ?? "—"}
              </p>
              {change !== null && (
                <p
                  className={`mt-0.5 font-mono text-xs ${
                    change >= 0 ? "text-[#2ea85a]" : "text-[#e24b35]"
                  }`}
                >
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                </p>
              )}
              <div className="mt-2">
                <SparklineArea color={color} data={filteredData} height={50} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create the server component**

Create `apps/web/components/sections/markets-deep-dive.tsx`:

```typescript
import { SectionHeader } from "@workspace/ui/components/section-header";
import { MarketsCharts } from "@/components/sections/markets-charts";
import { getMarketData } from "@/lib/queries";

export async function MarketsDeepDive() {
  const { nzx50, bellwethers, quotes } = await getMarketData();

  const nzx50Quote = quotes.find((q) => q.ticker === "^NZ50");
  const latestClose = nzx50Quote?.close;
  const subtitle = latestClose
    ? `NZX 50: ${latestClose.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}`
    : "NZX 50 Index & Bellwethers";

  return (
    <section className="px-6 py-10">
      <SectionHeader subtitle={subtitle} title="Markets" />
      <MarketsCharts
        bellwethers={bellwethers}
        nzx50={nzx50}
        quotes={quotes}
      />
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sections/markets-charts.tsx apps/web/components/sections/markets-deep-dive.tsx
git commit -m "feat: add Markets deep-dive section with candlestick + bellwether cards"
```

---

### Task 14: Add Markets section to the page

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Import MarketsDeepDive**

Add to the imports at the top of `apps/web/app/page.tsx`:

```typescript
import { MarketsDeepDive } from "@/components/sections/markets-deep-dive";
```

- [ ] **Step 2: Add to the page after CurrencyDeepDive**

In the JSX, add after the `CurrencyDeepDive` div and before the `SponsorCTA` div:

```typescript
          <div className="border-[#e5e0d5] border-t">
            <MarketsDeepDive />
          </div>
```

- [ ] **Step 3: Add "NZX 50" to the Dataset structured data**

In the `STRUCTURED_DATA` array, add `"NZX 50 Index"` to the `variableMeasured` array:

```typescript
    variableMeasured: [
      "Consumer Price Index",
      "Official Cash Rate",
      "NZD Exchange Rates",
      "Fuel Prices",
      "Grocery Prices",
      "Median House Price",
      "Mortgage Rates",
      "Unemployment Rate",
      "Wage Growth",
      "NZX 50 Index",
    ],
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: add Markets section to dashboard page"
```

---

### Task 15: Lint, build, and verify

**Files:**
- (none — verification only)

- [ ] **Step 1: Run lint/format check**

```bash
bun run check
```

Fix any issues with `bun run fix` if needed.

- [ ] **Step 2: Run all tests**

```bash
cd packages/db && bun test
```

Expected: All tests pass including the new stock query tests.

- [ ] **Step 3: Build the web app**

```bash
bun run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Start the dev server and verify**

```bash
bun run dev:web
```

Open `http://localhost:3000` and scroll to the Markets section. Verify:
- NZX 50 candlestick chart renders with correct theming
- 4 bellwether cards show close price, % change, and sparklines
- Time range selector (90D, 1Y, 5Y, All) works
- NZX 50 appears in the ticker marquee
- No console errors

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: lint and formatting fixes"
```

(Skip if no fixes were needed.)
