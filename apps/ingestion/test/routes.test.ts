import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import { registry } from "../src/collectors/registry";
import type { CollectorResult } from "../src/collectors/types";

// Register a mock collector for testing
const mockResults: CollectorResult[] = [
  { metric: "petrol_91", value: 2.85, unit: "nzd_per_litre", date: "2026-03-29", source: "mock" },
];
registry["mock"] = async () => mockResults;

// Build a test-only app that doesn't touch a real DB
const collected: CollectorResult[][] = [];

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
    collected.push(results);
    return { source: params.source, collected: results.length };
  });

describe("ingestion routes", () => {
  test("GET /health returns ok with collector list", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.collectors).toContain("mock");
  });

  test("POST /collect/:source runs collector and returns count", async () => {
    const response = await app.handle(
      new Request("http://localhost/collect/mock", { method: "POST" })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("mock");
    expect(body.collected).toBe(1);
  });

  test("POST /collect/:source returns 404 for unknown collector", async () => {
    const response = await app.handle(
      new Request("http://localhost/collect/nonexistent", { method: "POST" })
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("nonexistent");
  });
});
