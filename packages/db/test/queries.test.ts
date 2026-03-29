import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as schema from "../src/schema";
import {
  getLatestValue,
  getTimeSeries,
  getLatestByCategory,
  bulkInsert,
} from "../src/queries";

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

  beforeEach(async () => {
    await testDb.run(sql`DELETE FROM metrics`);
  });

  afterAll(() => {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}
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
