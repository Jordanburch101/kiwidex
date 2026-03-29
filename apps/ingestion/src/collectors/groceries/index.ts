import { db, insertProducts, type NewProduct } from "@workspace/db";
import type { MetricKey } from "@workspace/db/metrics";
import type { CollectorResult } from "../types";
import { BASKET } from "./basket";
import { scrapeNewWorld } from "./newworld";
import { scrapePakNSave } from "./paknsave";
import type { ScrapedProduct } from "./types";
import { scrapeWoolworths } from "./woolworths";

const GROCERY_METRICS: MetricKey[] = [
  "milk",
  "eggs",
  "bread",
  "butter",
  "cheese",
];

/**
 * Grocery collector: scrapes all 3 supermarkets, writes product-level data
 * to the `products` table, and computes headline averages for the `metrics` table.
 *
 * Handles partial failures gracefully: if one store fails, results from the
 * other stores are still used.
 */
export default async function collectGroceries(): Promise<CollectorResult[]> {
  const errors: string[] = [];
  let woolworthsProducts: ScrapedProduct[] = [];
  let paknsaveProducts: ScrapedProduct[] = [];
  let newworldProducts: ScrapedProduct[] = [];

  // Scrape all 3 stores (sequentially to avoid overloading)
  try {
    woolworthsProducts = await scrapeWoolworths(BASKET);
  } catch (e) {
    const msg = `[groceries] Woolworths failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  try {
    paknsaveProducts = await scrapePakNSave(BASKET);
  } catch (e) {
    const msg = `[groceries] Pak'nSave failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  // New World is currently blocked by Cloudflare (all requests timeout).
  // Disabled to avoid ~3min of wasted time. Re-enable when bypass is found.
  // try {
  //   newworldProducts = await scrapeNewWorld(BASKET);
  // } catch (e) {
  //   const msg = `[groceries] New World failed: ${e instanceof Error ? e.message : e}`;
  //   console.error(msg);
  //   errors.push(msg);
  // }

  const allProducts = [
    ...woolworthsProducts,
    ...paknsaveProducts,
    ...newworldProducts,
  ];

  if (allProducts.length === 0) {
    throw new Error(
      `All grocery sources failed:\n${errors.join("\n") || "No products scraped from any source"}`
    );
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
  const results: CollectorResult[] = [];

  for (const metric of GROCERY_METRICS) {
    const storeMap = byCategoryStore.get(metric);
    if (!storeMap || storeMap.size === 0) {
      console.warn(`[groceries] No products found for ${metric}`);
      continue;
    }

    // Calculate per-store averages
    const storeAverages: Record<string, number> = {};
    let totalSum = 0;
    let totalCount = 0;
    const sources: string[] = [];

    for (const [store, prices] of storeMap) {
      const avg =
        Math.round(
          (prices.reduce((a, b) => a + b, 0) / prices.length) * 100
        ) / 100;
      storeAverages[store] = avg;
      totalSum += prices.reduce((a, b) => a + b, 0);
      totalCount += prices.length;
      sources.push(store);
    }

    // Overall average across all products from all stores
    const overallAverage = Math.round((totalSum / totalCount) * 100) / 100;

    const metadata = JSON.stringify({
      woolworths_avg: storeAverages["woolworths.co.nz"] ?? null,
      paknsave_avg: storeAverages["paknsave.co.nz"] ?? null,
      newworld_avg: storeAverages["newworld.co.nz"] ?? null,
      product_count: totalCount,
    });

    results.push({
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
    `[groceries] Total: ${results.length}/${GROCERY_METRICS.length} grocery prices collected, ${allProducts.length} products recorded`
  );
  return results;
}
