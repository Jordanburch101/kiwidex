# NZ Ecom Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for an NZ economic health dashboard — shared DB package with Drizzle + libSQL, an Elysia-based ingestion service with collector framework, and a placeholder web UI proving end-to-end data flow.

**Architecture:** Monorepo with `packages/db` (Drizzle schema, client, queries shared by both apps), `apps/ingestion` (Bun + Elysia service with pluggable collector modules), and `apps/web` (Next.js 16 reading from DB via cache components). Data flows from collectors → bulkInsert → libSQL → query helpers → Server Components → browser.

**Tech Stack:** Bun 1.3.9, Turborepo, Drizzle ORM + libSQL, Elysia, Next.js 16, TypeScript 5.9

---

## File Structure

```
packages/db/
  package.json
  tsconfig.json
  drizzle.config.ts
  src/
    index.ts            — Re-exports client, schema, queries
    client.ts           — libSQL client + Drizzle instance
    schema.ts           — Drizzle table definition
    metrics.ts          — Metric keys, categories, display metadata
    queries.ts          — getLatestValue, getTimeSeries, getLatestByCategory, bulkInsert
  test/
    queries.test.ts     — Tests for query helpers against in-memory DB

apps/ingestion/
  package.json
  tsconfig.json
  src/
    index.ts            — Elysia app entry point
    collectors/
      types.ts          — CollectorResult type, Collector interface
      registry.ts       — Collector registry (name → collector map)
    lib/
      scraper.ts        — Shared fetch/parse utilities (placeholder)
  test/
    routes.test.ts      — Elysia route tests

apps/web/
  app/
    page.tsx            — Replaced with placeholder dashboard
    api/
      revalidate/
        route.ts        — POST /api/revalidate?tag=X
```

---

### Task 1: Create `packages/db` package scaffold

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@workspace/db",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "bun test"
  },
  "dependencies": {
    "@libsql/client": "^0.15.0",
    "drizzle-orm": "^0.44.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.9.3"
  },
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./schema": "./src/schema.ts",
    "./metrics": "./src/metrics.ts",
    "./queries": "./src/queries.ts"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@workspace/db/*": ["./src/*"]
    },
    "strictNullChecks": true
  },
  "include": ["src", "test", "drizzle.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
```

- [ ] **Step 4: Create `packages/db/src/index.ts`**

```typescript
export { db } from "./client.js";
export { metrics } from "./schema.js";
export {
  getLatestValue,
  getTimeSeries,
  getLatestByCategory,
  bulkInsert,
} from "./queries.js";
export {
  METRIC_KEYS,
  METRIC_CATEGORIES,
  METRIC_META,
  type MetricKey,
  type MetricCategory,
  type MetricMeta,
} from "./metrics.js";
```

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun install`
Expected: Dependencies resolve. `@workspace/db` appears in workspace.

- [ ] **Step 6: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts packages/db/src/index.ts
git commit -m "feat(db): scaffold packages/db with drizzle + libsql config"
```

---

### Task 2: Define metric types and schema

**Files:**
- Create: `packages/db/src/metrics.ts`
- Create: `packages/db/src/schema.ts`

- [ ] **Step 1: Create `packages/db/src/metrics.ts`**

```typescript
export const METRIC_CATEGORIES = {
  everyday_costs: "Everyday Costs",
  housing: "Housing",
  employment_income: "Employment & Income",
  macro_financial: "Macro / Financial",
} as const;

export type MetricCategory = keyof typeof METRIC_CATEGORIES;

export type MetricMeta = {
  label: string;
  unit: string;
  category: MetricCategory;
  description: string;
};

export const METRIC_META = {
  petrol_91: {
    label: "Petrol 91",
    unit: "nzd_per_litre",
    category: "everyday_costs",
    description: "91 octane petrol price",
  },
  petrol_95: {
    label: "Petrol 95",
    unit: "nzd_per_litre",
    category: "everyday_costs",
    description: "95 octane petrol price",
  },
  petrol_diesel: {
    label: "Diesel",
    unit: "nzd_per_litre",
    category: "everyday_costs",
    description: "Diesel price",
  },
  milk: {
    label: "Milk",
    unit: "nzd",
    category: "everyday_costs",
    description: "2L standard milk",
  },
  eggs: {
    label: "Eggs",
    unit: "nzd",
    category: "everyday_costs",
    description: "Dozen size 7 eggs",
  },
  bread: {
    label: "Bread",
    unit: "nzd",
    category: "everyday_costs",
    description: "White loaf",
  },
  butter: {
    label: "Butter",
    unit: "nzd",
    category: "everyday_costs",
    description: "500g block",
  },
  cheese: {
    label: "Cheese",
    unit: "nzd",
    category: "everyday_costs",
    description: "1kg mild cheese",
  },
  rent_national: {
    label: "Rent",
    unit: "nzd_per_week",
    category: "everyday_costs",
    description: "Median weekly rent (national)",
  },
  electricity: {
    label: "Electricity",
    unit: "nzd_per_kwh",
    category: "everyday_costs",
    description: "Average residential electricity price",
  },
  house_price_median: {
    label: "Median House Price",
    unit: "nzd",
    category: "housing",
    description: "National median house price",
  },
  mortgage_floating: {
    label: "Mortgage (Floating)",
    unit: "percent",
    category: "housing",
    description: "Floating mortgage rate",
  },
  mortgage_1yr: {
    label: "Mortgage (1yr Fixed)",
    unit: "percent",
    category: "housing",
    description: "1-year fixed mortgage rate",
  },
  mortgage_2yr: {
    label: "Mortgage (2yr Fixed)",
    unit: "percent",
    category: "housing",
    description: "2-year fixed mortgage rate",
  },
  rent_vs_buy: {
    label: "Rent vs Buy",
    unit: "ratio",
    category: "housing",
    description: "Rent-to-price ratio",
  },
  unemployment: {
    label: "Unemployment",
    unit: "percent",
    category: "employment_income",
    description: "Unemployment rate",
  },
  median_income: {
    label: "Median Income",
    unit: "nzd",
    category: "employment_income",
    description: "Median annual income",
  },
  wage_growth: {
    label: "Wage Growth",
    unit: "percent",
    category: "employment_income",
    description: "Annual wage growth",
  },
  minimum_wage: {
    label: "Minimum Wage",
    unit: "nzd_per_hour",
    category: "employment_income",
    description: "Current minimum wage",
  },
  ocr: {
    label: "OCR",
    unit: "percent",
    category: "macro_financial",
    description: "Official Cash Rate",
  },
  cpi: {
    label: "CPI",
    unit: "percent",
    category: "macro_financial",
    description: "Consumer Price Index annual change",
  },
  nzd_usd: {
    label: "NZD/USD",
    unit: "ratio",
    category: "macro_financial",
    description: "NZD to USD exchange rate",
  },
  nzd_aud: {
    label: "NZD/AUD",
    unit: "ratio",
    category: "macro_financial",
    description: "NZD to AUD exchange rate",
  },
  nzd_eur: {
    label: "NZD/EUR",
    unit: "ratio",
    category: "macro_financial",
    description: "NZD to EUR exchange rate",
  },
  gdp_growth: {
    label: "GDP Growth",
    unit: "percent",
    category: "macro_financial",
    description: "GDP quarterly growth",
  },
} as const satisfies Record<string, MetricMeta>;

export type MetricKey = keyof typeof METRIC_META;
export const METRIC_KEYS = Object.keys(METRIC_META) as MetricKey[];
```

- [ ] **Step 2: Create `packages/db/src/schema.ts`**

```typescript
import { sqliteTable, text, real, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const metrics = sqliteTable(
  "metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    date: text("date").notNull(),
    source: text("source"),
    metadata: text("metadata"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("metric_date_uniq").on(table.metric, table.date),
    index("metric_date_idx").on(table.metric, table.date),
  ]
);
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/metrics.ts packages/db/src/schema.ts
git commit -m "feat(db): add metrics enum and drizzle schema"
```

---

### Task 3: DB client setup

**Files:**
- Create: `packages/db/src/client.ts`

- [ ] **Step 1: Create `packages/db/src/client.ts`**

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Generate initial migration**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx drizzle-kit generate`
Expected: Creates `drizzle/` directory with SQL migration file.

- [ ] **Step 4: Push schema to local dev DB**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx drizzle-kit push`
Expected: Creates `metrics` table in `local.db`. Output shows table creation.

- [ ] **Step 5: Add `local.db*` to `.gitignore`**

Append to `/Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/.gitignore`:

```
# Local dev database
*.db
*.db-journal
*.db-wal
*.db-shm
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/client.ts packages/db/drizzle/ .gitignore
git commit -m "feat(db): add libsql client and initial migration"
```

---

### Task 4: Query helpers — write failing tests

**Files:**
- Create: `packages/db/test/queries.test.ts`

- [ ] **Step 1: Create `packages/db/test/queries.test.ts`**

This tests all four query helpers against an in-memory libSQL database.

```typescript
import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/schema.js";
import {
  getLatestValue,
  getTimeSeries,
  getLatestByCategory,
  bulkInsert,
} from "../src/queries.js";

function createTestDb() {
  const client = createClient({ url: ":memory:" });
  return drizzle(client, { schema });
}

describe("query helpers", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeAll(async () => {
    testDb = createTestDb();
    await testDb.run(sql`
      CREATE TABLE metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        date TEXT NOT NULL,
        source TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await testDb.run(sql`
      CREATE UNIQUE INDEX metric_date_uniq ON metrics (metric, date)
    `);
  });

  beforeEach(async () => {
    await testDb.run(sql`DELETE FROM metrics`);
  });

  describe("bulkInsert", () => {
    test("inserts multiple data points", async () => {
      await bulkInsert(testDb, [
        { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-01", source: "test" },
        { metric: "petrol_91", value: 2.90, unit: "nzd_per_litre", date: "2026-03-02", source: "test" },
      ]);
      const rows = await testDb.select().from(schema.metrics);
      expect(rows).toHaveLength(2);
    });

    test("upserts on duplicate metric+date", async () => {
      await bulkInsert(testDb, [
        { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-01", source: "test" },
      ]);
      await bulkInsert(testDb, [
        { metric: "petrol_91", value: 2.99, unit: "nzd_per_litre", date: "2026-03-01", source: "test-updated" },
      ]);
      const rows = await testDb.select().from(schema.metrics);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe(2.99);
    });
  });

  describe("getLatestValue", () => {
    test("returns most recent data point for a metric", async () => {
      await bulkInsert(testDb, [
        { metric: "petrol_91", value: 2.80, unit: "nzd_per_litre", date: "2026-03-01", source: "test" },
        { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-15", source: "test" },
        { metric: "petrol_91", value: 2.90, unit: "nzd_per_litre", date: "2026-03-29", source: "test" },
      ]);
      const result = await getLatestValue(testDb, "petrol_91");
      expect(result).not.toBeNull();
      expect(result!.value).toBe(2.90);
      expect(result!.date).toBe("2026-03-29");
    });

    test("returns null for unknown metric", async () => {
      const result = await getLatestValue(testDb, "petrol_91");
      expect(result).toBeNull();
    });
  });

  describe("getTimeSeries", () => {
    test("returns values between dates ordered by date", async () => {
      await bulkInsert(testDb, [
        { metric: "ocr", value: 4.25, unit: "percent", date: "2026-01-01", source: "test" },
        { metric: "ocr", value: 4.00, unit: "percent", date: "2026-02-01", source: "test" },
        { metric: "ocr", value: 3.75, unit: "percent", date: "2026-03-01", source: "test" },
        { metric: "ocr", value: 3.50, unit: "percent", date: "2026-04-01", source: "test" },
      ]);
      const results = await getTimeSeries(testDb, "ocr", "2026-01-15", "2026-03-15");
      expect(results).toHaveLength(2);
      expect(results[0]!.value).toBe(4.00);
      expect(results[1]!.value).toBe(3.75);
    });

    test("returns empty array for no matches", async () => {
      const results = await getTimeSeries(testDb, "ocr", "2026-01-01", "2026-12-31");
      expect(results).toHaveLength(0);
    });
  });

  describe("getLatestByCategory", () => {
    test("returns latest value for each metric in a category", async () => {
      await bulkInsert(testDb, [
        { metric: "ocr", value: 4.25, unit: "percent", date: "2026-01-01", source: "test" },
        { metric: "ocr", value: 3.75, unit: "percent", date: "2026-03-01", source: "test" },
        { metric: "cpi", value: 5.1, unit: "percent", date: "2026-02-01", source: "test" },
        { metric: "nzd_usd", value: 0.62, unit: "ratio", date: "2026-03-15", source: "test" },
        { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-01", source: "test" },
      ]);
      const results = await getLatestByCategory(testDb, "macro_financial");
      expect(results).toHaveLength(3);
      const ocrResult = results.find((r) => r.metric === "ocr");
      expect(ocrResult!.value).toBe(3.75);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bun test`
Expected: FAIL — `Cannot find module "../src/queries.js"`

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/db/test/queries.test.ts
git commit -m "test(db): add failing tests for query helpers"
```

---

### Task 5: Query helpers — implement

**Files:**
- Create: `packages/db/src/queries.ts`

- [ ] **Step 1: Create `packages/db/src/queries.ts`**

```typescript
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { metrics } from "./schema.js";
import { METRIC_META, type MetricKey, type MetricCategory } from "./metrics.js";
import type * as schema from "./schema.js";

type Db = LibSQLDatabase<typeof schema>;

type DataPoint = {
  metric: string;
  value: number;
  unit: string;
  date: string;
  source?: string;
  metadata?: string;
};

export async function getLatestValue(db: Db, metric: MetricKey) {
  const rows = await db
    .select()
    .from(metrics)
    .where(eq(metrics.metric, metric))
    .orderBy(desc(metrics.date))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTimeSeries(
  db: Db,
  metric: MetricKey,
  from: string,
  to: string
) {
  return db
    .select()
    .from(metrics)
    .where(
      and(
        eq(metrics.metric, metric),
        gte(metrics.date, from),
        lte(metrics.date, to)
      )
    )
    .orderBy(metrics.date);
}

export async function getLatestByCategory(db: Db, category: MetricCategory) {
  const categoryMetrics = Object.entries(METRIC_META)
    .filter(([, meta]) => meta.category === category)
    .map(([key]) => key);

  const results: (typeof metrics.$inferSelect)[] = [];

  for (const metricKey of categoryMetrics) {
    const row = await getLatestValue(db, metricKey as MetricKey);
    if (row) results.push(row);
  }

  return results;
}

export async function bulkInsert(db: Db, dataPoints: DataPoint[]) {
  if (dataPoints.length === 0) return;

  for (const point of dataPoints) {
    await db
      .insert(metrics)
      .values({
        metric: point.metric,
        value: point.value,
        unit: point.unit,
        date: point.date,
        source: point.source ?? null,
        metadata: point.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [metrics.metric, metrics.date],
        set: {
          value: sql`excluded.value`,
          unit: sql`excluded.unit`,
          source: sql`excluded.source`,
          metadata: sql`excluded.metadata`,
          createdAt: sql`datetime('now')`,
        },
      });
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bun test`
Expected: All tests PASS.

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): implement query helpers (getLatestValue, getTimeSeries, getLatestByCategory, bulkInsert)"
```

---

### Task 6: Create `apps/ingestion` scaffold

**Files:**
- Create: `apps/ingestion/package.json`
- Create: `apps/ingestion/tsconfig.json`
- Create: `apps/ingestion/src/index.ts`

- [ ] **Step 1: Create `apps/ingestion/package.json`**

```json
{
  "name": "ingestion",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@workspace/db": "workspace:*",
    "elysia": "^1.3.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `apps/ingestion/tsconfig.json`**

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/db/*": ["../../packages/db/src/*"],
      "@workspace/db": ["../../packages/db/src/index.ts"]
    },
    "strictNullChecks": true
  },
  "include": ["src", "test"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/ingestion/src/index.ts`**

```typescript
import { Elysia } from "elysia";
import { registry } from "./collectors/registry.js";
import { bulkInsert, db } from "@workspace/db";

const app = new Elysia()
  .get("/health", () => ({ status: "ok", collectors: Object.keys(registry) }))
  .post("/collect/:source", async ({ params }) => {
    const collector = registry[params.source];
    if (!collector) {
      return new Response(
        JSON.stringify({ error: `Unknown collector: ${params.source}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await collector();
    await bulkInsert(db, results);
    return { source: params.source, collected: results.length };
  })
  .post("/collect/all", async () => {
    const summary: Record<string, number> = {};

    for (const [name, collector] of Object.entries(registry)) {
      const results = await collector();
      await bulkInsert(db, results);
      summary[name] = results.length;
    }

    return { summary };
  })
  .listen(Number(process.env.PORT) || 3001);

console.log(`Ingestion service running at http://localhost:${app.server?.port}`);
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun install`
Expected: Dependencies resolve. Elysia installed under `apps/ingestion`.

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/package.json apps/ingestion/tsconfig.json apps/ingestion/src/index.ts
git commit -m "feat(ingestion): scaffold elysia app with collect routes"
```

---

### Task 7: Collector framework — types and registry

**Files:**
- Create: `apps/ingestion/src/collectors/types.ts`
- Create: `apps/ingestion/src/collectors/registry.ts`
- Create: `apps/ingestion/src/lib/scraper.ts`

- [ ] **Step 1: Create `apps/ingestion/src/collectors/types.ts`**

```typescript
import type { MetricKey } from "@workspace/db/metrics";

export type CollectorResult = {
  metric: MetricKey;
  value: number;
  unit: string;
  date: string;
  source: string;
  metadata?: string;
};

export type Collector = () => Promise<CollectorResult[]>;
```

- [ ] **Step 2: Create `apps/ingestion/src/collectors/registry.ts`**

This is the central registry. As collectors are built, they get imported and registered here.

```typescript
import type { Collector } from "./types.js";

export const registry: Record<string, Collector> = {
  // Collectors are registered here as they're built:
  // petrol: petrolCollector,
  // rbnz: rbnzCollector,
  // etc.
};
```

- [ ] **Step 3: Create `apps/ingestion/src/lib/scraper.ts`**

Shared utilities for fetching and parsing. Placeholder for now — will be fleshed out when building specific collectors.

```typescript
export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function parseCSVLines(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/ingestion && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/types.ts apps/ingestion/src/collectors/registry.ts apps/ingestion/src/lib/scraper.ts
git commit -m "feat(ingestion): add collector types, registry, and shared scraper utils"
```

---

### Task 8: Ingestion route tests

**Files:**
- Create: `apps/ingestion/test/routes.test.ts`

- [ ] **Step 1: Create `apps/ingestion/test/routes.test.ts`**

Tests the Elysia routes using Elysia's built-in test helpers (`.handle()`).

```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { registry } from "../src/collectors/registry.js";
import type { CollectorResult } from "../src/collectors/types.js";

// Register a mock collector for testing
const mockResults: CollectorResult[] = [
  { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-29", source: "mock" },
];
registry["mock"] = async () => mockResults;

// Build a test-only app that doesn't touch a real DB
const collected: CollectorResult[][] = [];

const app = new Elysia()
  .get("/health", () => ({ status: "ok", collectors: Object.keys(registry) }))
  .post("/collect/:source", async ({ params }) => {
    const collector = registry[params.source];
    if (!collector) {
      return new Response(
        JSON.stringify({ error: `Unknown collector: ${params.source}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    const results = await collector();
    collected.push(results);
    return { source: params.source, collected: results.length };
  });

describe("ingestion routes", () => {
  test("GET /health returns ok with collector list", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.collectors).toContain("mock");
  });

  test("POST /collect/:source runs collector and returns count", async () => {
    const response = await app.handle(
      new Request("http://localhost/collect/mock", { method: "POST" })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("mock");
    expect(body.collected).toBe(1);
  });

  test("POST /collect/:source returns 404 for unknown collector", async () => {
    const response = await app.handle(
      new Request("http://localhost/collect/nonexistent", { method: "POST" })
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("nonexistent");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/ingestion && bun test`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/test/routes.test.ts
git commit -m "test(ingestion): add elysia route tests with mock collector"
```

---

### Task 9: Wire up web app — add DB dependency and placeholder dashboard

**Files:**
- Modify: `apps/web/package.json` (add `@workspace/db` dependency)
- Modify: `apps/web/next.config.mjs` (add `@workspace/db` to transpilePackages)
- Modify: `apps/web/tsconfig.json` (add `@workspace/db` path)
- Modify: `apps/web/app/page.tsx` (replace with placeholder dashboard)

- [ ] **Step 1: Add `@workspace/db` to `apps/web/package.json` dependencies**

Add to the `dependencies` object in `apps/web/package.json`:

```json
"@workspace/db": "workspace:*"
```

- [ ] **Step 2: Add `@workspace/db` to `apps/web/next.config.mjs` transpilePackages**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db"],
}

export default nextConfig
```

- [ ] **Step 3: Add `@workspace/db` path to `apps/web/tsconfig.json`**

Add to the `paths` object:

```json
"@workspace/db/*": ["../../packages/db/src/*"],
"@workspace/db": ["../../packages/db/src/index.ts"]
```

- [ ] **Step 4: Replace `apps/web/app/page.tsx` with placeholder dashboard**

```tsx
import {
  getLatestByCategory,
  METRIC_CATEGORIES,
  METRIC_META,
  type MetricKey,
  type MetricCategory,
} from "@workspace/db";
import { db } from "@workspace/db/client";

function formatValue(metric: MetricKey, value: number): string {
  const meta = METRIC_META[metric];
  switch (meta.unit) {
    case "nzd":
      return `$${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "nzd_per_litre":
      return `$${value.toFixed(3)}/L`;
    case "nzd_per_kwh":
      return `$${value.toFixed(4)}/kWh`;
    case "nzd_per_week":
      return `$${value.toFixed(0)}/wk`;
    case "nzd_per_hour":
      return `$${value.toFixed(2)}/hr`;
    case "percent":
      return `${value.toFixed(2)}%`;
    case "ratio":
      return value.toFixed(4);
    default:
      return value.toString();
  }
}

async function CategorySection({ category }: { category: MetricCategory }) {
  const data = await getLatestByCategory(db, category);

  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-4 font-heading text-xl font-semibold">
        {METRIC_CATEGORIES[category]}
      </h2>
      {data.length === 0 ? (
        <p className="text-muted-foreground font-mono text-sm">No data yet</p>
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-left text-xs">
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Date</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.metric} className="border-border border-t">
                  <td className="px-3 py-2">
                    {METRIC_META[row.metric as MetricKey]?.label ?? row.metric}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatValue(row.metric as MetricKey, row.value)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right font-mono text-xs">
                    {row.date}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.source ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Page() {
  const categories = Object.keys(METRIC_CATEGORIES) as MetricCategory[];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">NZ Economy Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Placeholder view — verifying data pipeline
        </p>
      </header>
      {categories.map((category) => (
        <CategorySection key={category} category={category} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Install dependencies**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun install`
Expected: Dependencies resolve.

- [ ] **Step 6: Verify typecheck**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/next.config.mjs apps/web/tsconfig.json apps/web/app/page.tsx
git commit -m "feat(web): add placeholder dashboard reading from @workspace/db"
```

---

### Task 10: Revalidation API route

**Files:**
- Create: `apps/web/app/api/revalidate/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/revalidate/route.ts`**

```typescript
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag");

  if (!tag) {
    return NextResponse.json(
      { error: "Missing ?tag= parameter" },
      { status: 400 }
    );
  }

  revalidateTag(tag);

  return NextResponse.json({ revalidated: true, tag });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/web && bunx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/revalidate/route.ts
git commit -m "feat(web): add revalidation endpoint for cache tag busting"
```

---

### Task 11: Seed script for end-to-end verification

**Files:**
- Create: `packages/db/src/seed.ts`

- [ ] **Step 1: Create `packages/db/src/seed.ts`**

A standalone script to populate the DB with sample data so the placeholder dashboard shows something.

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { bulkInsert } from "./queries.js";
import { METRIC_META, type MetricKey } from "./metrics.js";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

const sampleData: Array<{
  metric: MetricKey;
  value: number;
  unit: string;
  date: string;
  source: string;
}> = [
  // Everyday Costs
  { metric: "petrol_91", value: 2.879, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "petrol_95", value: 3.099, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "petrol_diesel", value: 2.159, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "milk", value: 3.49, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "eggs", value: 8.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "bread", value: 3.50, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "butter", value: 5.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "cheese", value: 14.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "rent_national", value: 590, unit: "nzd_per_week", date: "2026-03-29", source: "seed" },
  { metric: "electricity", value: 0.2850, unit: "nzd_per_kwh", date: "2026-03-29", source: "seed" },

  // Housing
  { metric: "house_price_median", value: 780000, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_floating", value: 8.64, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_1yr", value: 6.35, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_2yr", value: 5.99, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "rent_vs_buy", value: 0.039, unit: "ratio", date: "2026-03-29", source: "seed" },

  // Employment & Income
  { metric: "unemployment", value: 5.1, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "median_income", value: 65000, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "wage_growth", value: 3.2, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "minimum_wage", value: 23.15, unit: "nzd_per_hour", date: "2026-03-29", source: "seed" },

  // Macro / Financial
  { metric: "ocr", value: 3.75, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "cpi", value: 2.2, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "nzd_usd", value: 0.5680, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "nzd_aud", value: 0.9050, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "nzd_eur", value: 0.5210, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "gdp_growth", value: 0.4, unit: "percent", date: "2026-03-29", source: "seed" },
];

async function main() {
  console.log(`Seeding ${sampleData.length} data points...`);
  await bulkInsert(db, sampleData);
  console.log("Done.");
}

main().catch(console.error);
```

- [ ] **Step 2: Add seed script to `packages/db/package.json`**

Add to the `scripts` object:

```json
"db:seed": "bun run src/seed.ts"
```

- [ ] **Step 3: Push schema and run seed**

Run:
```bash
cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bunx drizzle-kit push && bun run db:seed
```
Expected: Schema pushed, then `Seeding 25 data points... Done.`

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed.ts packages/db/package.json
git commit -m "feat(db): add seed script with sample NZ economic data"
```

---

### Task 12: End-to-end verification

- [ ] **Step 1: Start the web app dev server**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/web && bun run dev`
Expected: Next.js dev server starts on `http://localhost:3000`

- [ ] **Step 2: Verify the dashboard shows seeded data**

Open `http://localhost:3000` in a browser. Verify:
- 4 category sections are visible (Everyday Costs, Housing, Employment & Income, Macro / Financial)
- Each section has a table with metric names, formatted values, dates, and "seed" as source
- Values are formatted correctly (e.g., `$2.879/L`, `3.75%`, `$780,000.00`)

- [ ] **Step 3: Start the ingestion service**

Run in a separate terminal: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/ingestion && bun run dev`
Expected: `Ingestion service running at http://localhost:3001`

- [ ] **Step 4: Verify health endpoint**

Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok","collectors":[]}` (empty registry is expected — no real collectors yet)

- [ ] **Step 5: Run all tests**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run typecheck`
Expected: All packages typecheck successfully.

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/packages/db && bun test`
Expected: All query helper tests pass.

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom/apps/ingestion && bun test`
Expected: All route tests pass.
