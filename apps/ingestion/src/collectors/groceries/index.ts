import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { db, insertProducts, type NewProduct } from "@workspace/db";
import type { MetricKey } from "@workspace/db/metrics";
import { recordRun } from "../../monitoring";
import type { CollectorResult } from "../types";
import type { ScrapedProduct } from "./types";

const GROCERY_METRICS: MetricKey[] = [
  "milk",
  "eggs",
  "bread",
  "butter",
  "cheese",
  "bananas",
];

const STORES = ["woolworths", "paknsave", "newworld"] as const;

const SCRAPE_SCRIPT = resolve(import.meta.dir, "scrape-store.ts");

/**
 * Run a single store scraper in a separate bun process.
 * Returns the scraped products, or empty array on failure.
 */
function scrapeInProcess(
  store: string,
  timeoutMs = 120_000
): Promise<ScrapedProduct[]> {
  return new Promise((resolvePromise) => {
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn("bun", ["run", SCRAPE_SCRIPT, store], {
      cwd: resolve(import.meta.dir, "../../.."),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      // Forward store logs to our stderr in real-time
      process.stderr.write(chunk);
    });

    child.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf-8").trim();
      if (code !== 0) {
        console.error(`[groceries] ${store} process exited with code ${code}`);
      }

      try {
        const products = JSON.parse(stdout || "[]") as ScrapedProduct[];
        resolvePromise(products);
      } catch {
        console.error(
          `[groceries] ${store} returned invalid JSON: ${stdout.slice(0, 200)}`
        );
        resolvePromise([]);
      }
    });

    child.on("error", (err) => {
      console.error(`[groceries] ${store} process error: ${err.message}`);
      resolvePromise([]);
    });
  });
}

/**
 * Grocery collector: scrapes each supermarket in a separate process,
 * writes product-level data to the `products` table, and computes
 * headline averages for the `metrics` table.
 */
export default async function collectGroceries(): Promise<CollectorResult[]> {
  console.log(
    `[groceries] Scraping ${STORES.length} stores in separate processes...`
  );

  // Run all stores in parallel (each in its own subprocess)
  const storeStarts = new Map<string, number>();
  for (const store of STORES) {
    console.log(`[groceries] Starting ${store} (separate process)...`);
    storeStarts.set(store, Date.now());
  }

  const results = await Promise.allSettled(
    STORES.map((store) => scrapeInProcess(store))
  );

  const allProducts: ScrapedProduct[] = [];
  for (let i = 0; i < STORES.length; i++) {
    const store = STORES[i]!;
    const result = results[i]!;
    const storeDuration = Date.now() - storeStarts.get(store)!;
    const products =
      result.status === "fulfilled" ? result.value : ([] as ScrapedProduct[]);

    console.log(`[groceries] ${store}: ${products.length} products`);
    allProducts.push(...products);

    // Record per-store scraper run
    const storeDomain = `${store}.co.nz`;
    if (products.length > 0) {
      const categoryCounts: Record<string, number> = {};
      for (const p of products) {
        categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
      }
      await recordRun("groceries", "success", {
        store: storeDomain,
        totalProducts: products.length,
        categories: categoryCounts,
        durationMs: storeDuration,
      });
    } else {
      const error =
        result.status === "rejected"
          ? String(result.reason)
          : `${store} returned 0 products`;
      await recordRun("groceries", "failed", {
        store: storeDomain,
        error,
        durationMs: storeDuration,
      });
    }
  }

  if (allProducts.length === 0) {
    throw new Error("All grocery sources failed: no products scraped");
  }

  // Write all individual product prices to the products table
  const today = new Date().toISOString().split("T")[0]!;

  const productRows: NewProduct[] = allProducts.map((p) => ({
    productId: p.productId,
    store: p.store,
    category: p.category,
    name: p.name,
    brand: p.brand,
    size: p.size,
    price: p.price,
    unitPrice: p.unitPrice ?? null,
    date: today,
    source: p.source,
  }));

  try {
    await insertProducts(db, productRows);
    console.log(
      `[groceries] Wrote ${productRows.length} product records to products table`
    );
  } catch (e) {
    console.error(
      `[groceries] Failed to write products: ${e instanceof Error ? e.message : e}`
    );
  }

  // Group products by category and store for averaging
  const byCategoryStore = new Map<string, Map<string, number[]>>();
  for (const p of allProducts) {
    if (!byCategoryStore.has(p.category)) {
      byCategoryStore.set(p.category, new Map());
    }
    const storeMap = byCategoryStore.get(p.category)!;
    if (!storeMap.has(p.store)) {
      storeMap.set(p.store, []);
    }
    storeMap.get(p.store)!.push(p.price);
  }

  // Compute headline averages for each basket category
  const metricResults: CollectorResult[] = [];

  for (const metric of GROCERY_METRICS) {
    const storeMap = byCategoryStore.get(metric);
    if (!storeMap || storeMap.size === 0) {
      console.warn(`[groceries] No products found for ${metric}`);
      continue;
    }

    // Calculate per-store averages, then average those (equal weight per store)
    const storeAverages: Record<string, number> = {};
    let totalCount = 0;
    const sources: string[] = [];

    for (const [store, prices] of storeMap) {
      const avg =
        Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) /
        100;
      storeAverages[store] = avg;
      totalCount += prices.length;
      sources.push(store);
    }

    const storeAvgValues = Object.values(storeAverages);
    const overallAverage =
      Math.round(
        (storeAvgValues.reduce((a, b) => a + b, 0) / storeAvgValues.length) *
          100
      ) / 100;

    const metadata = JSON.stringify({
      woolworths_avg: storeAverages["woolworths.co.nz"] ?? null,
      paknsave_avg: storeAverages["paknsave.co.nz"] ?? null,
      newworld_avg: storeAverages["newworld.co.nz"] ?? null,
      product_count: totalCount,
    });

    metricResults.push({
      metric,
      value: overallAverage,
      unit: "nzd",
      date: today,
      source: sources.join(", "),
      metadata,
    });

    console.log(
      `[groceries] ${metric}: $${overallAverage} (avg from ${totalCount} products across ${sources.join(" + ")})`
    );
  }

  console.log(
    `[groceries] Total: ${metricResults.length}/${GROCERY_METRICS.length} grocery prices collected, ${allProducts.length} products recorded`
  );
  return metricResults;
}
