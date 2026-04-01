import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  bulkInsert,
  getAllLatestQuotes,
  getLatestByCategory,
  getLatestStockQuote,
  getLatestValue,
  getStockTimeSeries,
  getTimeSeries,
  insertStocks,
} from "../src/queries";
import * as schema from "../src/schema";

// Use a temp file DB instead of :memory: because libSQL in-memory mode
// creates separate connections per operation, breaking transactions.
const tmpDir = mkdtempSync(join(tmpdir(), "nz-ecom-test-"));
const dbPath = join(tmpDir, "test.db");

function createTestDb() {
  const client = createClient({ url: `file:${dbPath}` });
  return drizzle(client, { schema });
}

describe("query helpers", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeAll(async () => {
    testDb = createTestDb();
    await testDb.run(sql`
      CREATE TABLE IF NOT EXISTS metrics (
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
      CREATE UNIQUE INDEX IF NOT EXISTS metric_date_uniq ON metrics (metric, date)
    `);
  });

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

  beforeEach(async () => {
    await testDb.run(sql`DELETE FROM metrics`);
  });

  afterAll(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // Cleanup is best-effort
    }
  });

  describe("bulkInsert", () => {
    test("inserts multiple data points", async () => {
      await bulkInsert(testDb, [
        {
          metric: "petrol_91",
          value: 2.85,
          unit: "nzd_per_litre",
          date: "2026-03-01",
          source: "test",
        },
        {
          metric: "petrol_91",
          value: 2.9,
          unit: "nzd_per_litre",
          date: "2026-03-02",
          source: "test",
        },
      ]);
      const rows = await testDb.select().from(schema.metrics);
      expect(rows).toHaveLength(2);
    });

    test("upserts on duplicate metric+date", async () => {
      await bulkInsert(testDb, [
        {
          metric: "petrol_91",
          value: 2.85,
          unit: "nzd_per_litre",
          date: "2026-03-01",
          source: "test",
        },
      ]);
      await bulkInsert(testDb, [
        {
          metric: "petrol_91",
          value: 2.99,
          unit: "nzd_per_litre",
          date: "2026-03-01",
          source: "test-updated",
        },
      ]);
      const rows = await testDb.select().from(schema.metrics);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.value).toBe(2.99);
    });
  });

  describe("getLatestValue", () => {
    test("returns most recent data point for a metric", async () => {
      await bulkInsert(testDb, [
        {
          metric: "petrol_91",
          value: 2.8,
          unit: "nzd_per_litre",
          date: "2026-03-01",
          source: "test",
        },
        {
          metric: "petrol_91",
          value: 2.85,
          unit: "nzd_per_litre",
          date: "2026-03-15",
          source: "test",
        },
        {
          metric: "petrol_91",
          value: 2.9,
          unit: "nzd_per_litre",
          date: "2026-03-29",
          source: "test",
        },
      ]);
      const result = await getLatestValue(testDb, "petrol_91");
      expect(result).not.toBeNull();
      expect(result?.value).toBe(2.9);
      expect(result?.date).toBe("2026-03-29");
    });

    test("returns null for unknown metric", async () => {
      const result = await getLatestValue(testDb, "petrol_91");
      expect(result).toBeNull();
    });
  });

  describe("getTimeSeries", () => {
    test("returns values between dates ordered by date", async () => {
      await bulkInsert(testDb, [
        {
          metric: "ocr",
          value: 4.25,
          unit: "percent",
          date: "2026-01-01",
          source: "test",
        },
        {
          metric: "ocr",
          value: 4.0,
          unit: "percent",
          date: "2026-02-01",
          source: "test",
        },
        {
          metric: "ocr",
          value: 3.75,
          unit: "percent",
          date: "2026-03-01",
          source: "test",
        },
        {
          metric: "ocr",
          value: 3.5,
          unit: "percent",
          date: "2026-04-01",
          source: "test",
        },
      ]);
      const results = await getTimeSeries(
        testDb,
        "ocr",
        "2026-01-15",
        "2026-03-15"
      );
      expect(results).toHaveLength(2);
      expect(results[0]?.value).toBe(4.0);
      expect(results[1]?.value).toBe(3.75);
    });

    test("returns empty array for no matches", async () => {
      const results = await getTimeSeries(
        testDb,
        "ocr",
        "2026-01-01",
        "2026-12-31"
      );
      expect(results).toHaveLength(0);
    });
  });

  describe("getLatestByCategory", () => {
    test("returns latest value for each metric in a category", async () => {
      await bulkInsert(testDb, [
        {
          metric: "ocr",
          value: 4.25,
          unit: "percent",
          date: "2026-01-01",
          source: "test",
        },
        {
          metric: "ocr",
          value: 3.75,
          unit: "percent",
          date: "2026-03-01",
          source: "test",
        },
        {
          metric: "cpi",
          value: 5.1,
          unit: "percent",
          date: "2026-02-01",
          source: "test",
        },
        {
          metric: "nzd_usd",
          value: 0.62,
          unit: "ratio",
          date: "2026-03-15",
          source: "test",
        },
        {
          metric: "petrol_91",
          value: 2.85,
          unit: "nzd_per_litre",
          date: "2026-03-01",
          source: "test",
        },
      ]);
      const results = await getLatestByCategory(testDb, "macro_financial");
      expect(results).toHaveLength(3);
      const ocrResult = results.find((r) => r.metric === "ocr");
      expect(ocrResult?.value).toBe(3.75);
    });
  });

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
            open: 12_100,
            high: 12_200,
            low: 12_050,
            close: 12_150,
            volume: 50_000,
          },
        ]);
        const rows = await testDb.select().from(schema.stocks);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.close).toBe(12_150);
      });

      test("upserts on duplicate ticker+date", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12_100,
            high: 12_200,
            low: 12_050,
            close: 12_150,
            volume: 50_000,
          },
        ]);
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12_100,
            high: 12_250,
            low: 12_050,
            close: 12_200,
            volume: 55_000,
          },
        ]);
        const rows = await testDb.select().from(schema.stocks);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.close).toBe(12_200);
      });

      test("handles null volume", async () => {
        await insertStocks(testDb, [
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12_100,
            high: 12_200,
            low: 12_050,
            close: 12_150,
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
            volume: 1_000_000,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-27",
            open: 0.72,
            high: 0.74,
            low: 0.71,
            close: 0.73,
            volume: 900_000,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-28",
            open: 0.73,
            high: 0.75,
            low: 0.72,
            close: 0.74,
            volume: 1_100_000,
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
            volume: 200_000,
          },
          {
            ticker: "FPH.NZ",
            date: "2026-03-28",
            open: 30.5,
            high: 31.5,
            low: 30,
            close: 31,
            volume: 250_000,
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
            open: 12_000,
            high: 12_100,
            low: 11_900,
            close: 12_050,
            volume: null,
          },
          {
            ticker: "^NZ50",
            date: "2026-03-28",
            open: 12_050,
            high: 12_200,
            low: 12_000,
            close: 12_150,
            volume: null,
          },
          {
            ticker: "AIR.NZ",
            date: "2026-03-28",
            open: 0.72,
            high: 0.74,
            low: 0.71,
            close: 0.73,
            volume: 1_000_000,
          },
        ]);
        const results = await getAllLatestQuotes(testDb, ["^NZ50", "AIR.NZ"]);
        expect(results).toHaveLength(2);
        const nzx = results.find((r) => r.ticker === "^NZ50");
        expect(nzx?.close).toBe(12_150);
      });
    });
  });
});
