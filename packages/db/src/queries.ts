import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { METRIC_META, type MetricCategory, type MetricKey } from "./metrics";
import type * as schema from "./schema";
import { articles, metrics, products, scraperRuns, stocks, summaries } from "./schema";

type Db = LibSQLDatabase<typeof schema>;

export type NewProduct = typeof products.$inferInsert;
export type NewScraperRun = typeof scraperRuns.$inferInsert;
export type ScraperRun = typeof scraperRuns.$inferSelect;

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

  const now = new Date().toISOString();

  for (let i = 0; i < dataPoints.length; i += CHUNK_SIZE) {
    const chunk = dataPoints.slice(i, i + CHUNK_SIZE);
    await db
      .insert(metrics)
      .values(
        chunk.map((point) => ({
          metric: point.metric,
          value: point.value,
          unit: point.unit,
          date: point.date,
          source: point.source ?? null,
          metadata: point.metadata ?? null,
        }))
      )
      .onConflictDoUpdate({
        target: [metrics.metric, metrics.date],
        set: {
          value: sql`excluded.value`,
          unit: sql`excluded.unit`,
          source: sql`excluded.source`,
          metadata: sql`excluded.metadata`,
          createdAt: now,
        },
      });
  }
}

export async function insertProducts(db: Db, items: NewProduct[]) {
  if (items.length === 0) {
    return;
  }

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await db.transaction(async (tx) => {
      for (const item of chunk) {
        await tx
          .insert(products)
          .values(item)
          .onConflictDoUpdate({
            target: [products.productId, products.store, products.date],
            set: {
              name: sql`excluded.name`,
              brand: sql`excluded.brand`,
              size: sql`excluded.size`,
              price: sql`excluded.price`,
              unitPrice: sql`excluded.unit_price`,
              category: sql`excluded.category`,
              source: sql`excluded.source`,
              createdAt: new Date().toISOString(),
            },
          });
      }
    });
  }
}

export async function getProductsByCategory(
  db: Db,
  category: string,
  date?: string
) {
  const conditions = [eq(products.category, category)];
  if (date) {
    conditions.push(eq(products.date, date));
  }

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.date));
}

// --- Scraper run queries ---

export async function insertScraperRun(
  db: Db,
  run: NewScraperRun
): Promise<void> {
  await db.insert(scraperRuns).values(run);
}

export async function getLatestRuns(db: Db): Promise<ScraperRun[]> {
  const allRuns = await db
    .select()
    .from(scraperRuns)
    .orderBy(desc(scraperRuns.createdAt));

  const latest = new Map<string, ScraperRun>();
  for (const run of allRuns) {
    const key = run.store ? `${run.collector}:${run.store}` : run.collector;
    if (!latest.has(key)) {
      latest.set(key, run);
    }
  }

  return Array.from(latest.values());
}

export async function getLastSuccessDate(
  db: Db,
  collector: string,
  store?: string | null
): Promise<string | null> {
  const conditions = [
    eq(scraperRuns.collector, collector),
    eq(scraperRuns.status, "success"),
  ];
  if (store) {
    conditions.push(eq(scraperRuns.store, store));
  }

  const rows = await db
    .select({ date: scraperRuns.date, createdAt: scraperRuns.createdAt })
    .from(scraperRuns)
    .where(and(...conditions))
    .orderBy(desc(scraperRuns.createdAt))
    .limit(1);

  const match = rows[0];
  if (!match) {
    return null;
  }

  const days = Math.floor(
    (Date.now() - new Date(match.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return `${match.date} (${days} day${days === 1 ? "" : "s"} ago)`;
}

export async function getStaleCollectors(
  db: Db,
  maxAgeDays: number
): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffISO = cutoff.toISOString();

  const successfulRuns = await db
    .select()
    .from(scraperRuns)
    .where(eq(scraperRuns.status, "success"))
    .orderBy(desc(scraperRuns.createdAt));

  const latestSuccess = new Map<string, string>();
  for (const run of successfulRuns) {
    if (!latestSuccess.has(run.collector)) {
      latestSuccess.set(run.collector, run.createdAt);
    }
  }

  const stale: string[] = [];
  for (const [collector, lastSuccess] of latestSuccess) {
    if (lastSuccess < cutoffISO) {
      stale.push(collector);
    }
  }

  return stale;
}

// --- Article queries ---

export type NewArticle = typeof articles.$inferInsert;

export async function insertArticles(db: Db, items: NewArticle[]) {
  if (items.length === 0) {
    return;
  }

  for (const item of items) {
    await db
      .insert(articles)
      .values(item)
      .onConflictDoUpdate({
        target: [articles.url],
        set: {
          title: sql`excluded.title`,
          excerpt: sql`excluded.excerpt`,
          imageUrl: sql`excluded.image_url`,
          source: sql`excluded.source`,
          publishedAt: sql`excluded.published_at`,
          createdAt: new Date().toISOString(),
        },
      });
  }
}

// --- Summary queries ---

export type NewSummary = typeof summaries.$inferInsert;

export async function insertSummary(
  db: Db,
  content: string,
  metricsJson: string
) {
  await db.insert(summaries).values({ content, metrics: metricsJson });
}

export async function getLatestSummary(db: Db) {
  const rows = await db
    .select()
    .from(summaries)
    .orderBy(desc(summaries.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestArticles(db: Db, perSource: number) {
  const sources = ["rnz", "stuff", "herald", "1news"];

  const results = await Promise.all(
    sources.map((source) =>
      db
        .select()
        .from(articles)
        .where(eq(articles.source, source))
        .orderBy(desc(articles.publishedAt))
        .limit(perSource)
    )
  );

  return results
    .flat()
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

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
