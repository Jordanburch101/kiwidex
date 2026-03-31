import { cron } from "@elysiajs/cron";
import { bulkInsert, db } from "@workspace/db";
import { Elysia } from "elysia";
import { registry } from "./collectors/registry";
import { checkHealth } from "./monitoring";
import { revalidateWeb } from "./revalidate";

const RECENT_DAYS = 90;

function filterRecent<T extends { date: string }>(results: T[]): T[] {
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;
  return results.filter((r) => r.date >= cutoff);
}

function requireApiKey({
  headers,
}: {
  headers: Record<string, string | undefined>;
}) {
  const key = process.env.INGESTION_API_KEY;
  if (!key) {
    return; // No key configured = auth disabled (local dev)
  }

  const provided =
    headers["x-api-key"] || headers.authorization?.replace("Bearer ", "");
  if (provided !== key) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function runCollection() {
  console.log(
    `[cron] Starting scheduled collection at ${new Date().toISOString()}`
  );
  const summary: Record<string, { collected: number; error?: string }> = {};

  for (const [name, collector] of Object.entries(registry)) {
    try {
      const results = filterRecent(await collector());
      await bulkInsert(db, results);
      summary[name] = { collected: results.length };
    } catch (e) {
      console.error(`[cron] ${name} failed:`, e);
      summary[name] = {
        collected: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  await revalidateWeb();
  console.log("[cron] Collection complete:", summary);
  return summary;
}

const app = new Elysia()
  .use(
    cron({
      name: "collect-all",
      pattern: "0 20,1 * * *",
      runOnInit: true,
      run: runCollection,
    })
  )
  .get("/health", () => ({ status: "ok", collectors: Object.keys(registry) }))
  .get("/health/scrapers", async () => {
    const health = await checkHealth();
    const hasIssues = health.some(
      (h) =>
        h.status === "failed" ||
        (h.daysSinceLastSuccess !== null && h.daysSinceLastSuccess >= 3)
    );
    return {
      status: hasIssues ? "degraded" : "healthy",
      collectors: health,
    };
  })
  .post("/collect/all", async ({ headers }) => {
    requireApiKey({ headers });
    const summary = await runCollection();
    return { summary };
  })
  .post("/collect/:source", async ({ params, headers }) => {
    requireApiKey({ headers });

    const collector = registry[params.source];
    if (!collector) {
      return new Response(
        JSON.stringify({ error: `Unknown collector: ${params.source}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const results = filterRecent(await collector());
      await bulkInsert(db, results);
      await revalidateWeb();
      return { source: params.source, collected: results.length };
    } catch (e) {
      console.error(`[collect] ${params.source} failed:`, e);
      return new Response(
        JSON.stringify({
          error: "Collection failed",
          source: params.source,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })
  .listen(Number(process.env.PORT) || 3001);

console.log(
  `Ingestion service running at http://localhost:${app.server?.port}`
);
