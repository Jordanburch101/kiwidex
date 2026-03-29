import {
  db,
  getLatestRuns,
  insertScraperRun,
  type NewScraperRun,
  type ScraperRun,
} from "@workspace/db";

export interface RunDetails {
  categories?: Record<string, number>;
  durationMs?: number;
  error?: string;
  store?: string;
  totalProducts?: number;
}

export interface CollectorHealth {
  collector: string;
  daysSinceLastSuccess: number | null;
  error: string | null;
  lastRun: string;
  status: string;
  store: string | null;
  totalProducts: number | null;
}

export async function recordRun(
  collector: string,
  status: "success" | "partial" | "failed",
  details: RunDetails = {}
): Promise<void> {
  const run: NewScraperRun = {
    collector,
    store: details.store ?? null,
    status,
    totalProducts: details.totalProducts ?? null,
    categories: details.categories ? JSON.stringify(details.categories) : null,
    error: details.error ?? null,
    durationMs: details.durationMs ?? null,
    date: new Date().toISOString().split("T")[0]!,
  };

  await insertScraperRun(db, run);
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export async function checkHealth(): Promise<CollectorHealth[]> {
  const latestRuns = await getLatestRuns(db);

  return latestRuns.map((run: ScraperRun) => ({
    collector: run.collector,
    store: run.store,
    status: run.status,
    lastRun: run.createdAt,
    daysSinceLastSuccess:
      run.status === "success" ? daysSince(run.createdAt) : null,
    totalProducts: run.totalProducts,
    error: run.error,
  }));
}
