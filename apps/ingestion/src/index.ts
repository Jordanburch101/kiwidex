import { Elysia } from "elysia";
import { registry } from "./collectors/registry";
import { bulkInsert, db } from "@workspace/db";

const app = new Elysia()
  .get("/health", () => ({ status: "ok", collectors: Object.keys(registry) }))
  .post("/collect/all", async () => {
    const summary: Record<string, { collected: number; error?: string }> = {};

    for (const [name, collector] of Object.entries(registry)) {
      try {
        const results = await collector();
        await bulkInsert(db, results);
        summary[name] = { collected: results.length };
      } catch (e) {
        console.error(`[collect/all] ${name} failed:`, e);
        summary[name] = {
          collected: 0,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    }

    return { summary };
  })
  .post("/collect/:source", async ({ params }) => {
    const collector = registry[params.source];
    if (!collector) {
      return new Response(
        JSON.stringify({ error: `Unknown collector: ${params.source}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const results = await collector();
      await bulkInsert(db, results);
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
