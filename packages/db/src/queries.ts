import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { metrics } from "./schema";
import { METRIC_META, type MetricKey, type MetricCategory } from "./metrics";
import type * as schema from "./schema";

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
