// packages/db/src/queries.ts (placeholder — full implementation in Task 5)
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { MetricKey, MetricCategory } from "./metrics.js";
import type * as schema from "./schema.js";

type Db = LibSQLDatabase<typeof schema>;

export async function getLatestValue(_db: Db, _metric: MetricKey) {
  return null;
}

export async function getTimeSeries(_db: Db, _metric: MetricKey, _from: string, _to: string) {
  return [];
}

export async function getLatestByCategory(_db: Db, _category: MetricCategory) {
  return [];
}

export async function bulkInsert(_db: Db, _dataPoints: unknown[]) {}
