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
