import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { METRIC_META, type MetricCategory, type MetricKey } from "./metrics";
import type * as schema from "./schema";
import { metrics } from "./schema";

type Db = LibSQLDatabase<typeof schema>;

interface DataPoint {
  date: string;
  metadata?: string;
  metric: string;
  source?: string;
  unit: string;
  value: number;
}

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

  if (categoryMetrics.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(metrics)
    .where(inArray(metrics.metric, categoryMetrics))
    .orderBy(desc(metrics.date));

  const latest = new Map<string, typeof metrics.$inferSelect>();
  for (const row of rows) {
    if (!latest.has(row.metric)) {
      latest.set(row.metric, row);
    }
  }

  return Array.from(latest.values());
}

const CHUNK_SIZE = 500;

export async function bulkInsert(db: Db, dataPoints: DataPoint[]) {
  if (dataPoints.length === 0) {
    return;
  }

  for (let i = 0; i < dataPoints.length; i += CHUNK_SIZE) {
    const chunk = dataPoints.slice(i, i + CHUNK_SIZE);
    await db.transaction(async (tx) => {
      for (const point of chunk) {
        await tx
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
              createdAt: new Date().toISOString(),
            },
          });
      }
    });
  }
}
