import type { MetricKey } from "@workspace/db/metrics";
import type { CollectorResult } from "../types";
import { scrapePakNSave } from "./paknsave";
import type { ScrapedPrice } from "./types";
import { scrapeWoolworths } from "./woolworths";

const GROCERY_METRICS: MetricKey[] = [
  "milk",
  "eggs",
  "bread",
  "butter",
  "cheese",
];

/**
 * Grocery collector: combines Woolworths and Pak'nSave scraped prices
 * into averaged CollectorResults for each grocery metric.
 *
 * If one source fails entirely, uses the other source's prices.
 * If both sources fail, throws.
 */
export default async function collectGroceries(): Promise<CollectorResult[]> {
  const errors: string[] = [];
  let woolworthsPrices: ScrapedPrice[] = [];
  let paknsavePrices: ScrapedPrice[] = [];

  // Scrape Woolworths
  try {
    woolworthsPrices = await scrapeWoolworths();
  } catch (e) {
    const msg = `[groceries] Woolworths failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  // Scrape Pak'nSave
  try {
    paknsavePrices = await scrapePakNSave();
  } catch (e) {
    const msg = `[groceries] Pak'nSave failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  if (woolworthsPrices.length === 0 && paknsavePrices.length === 0) {
    throw new Error(
      `All grocery sources failed:\n${errors.join("\n") || "No prices scraped from either source"}`
    );
  }

  // Build a lookup by metric for each source
  const woolworthsMap = new Map<string, ScrapedPrice>();
  for (const p of woolworthsPrices) {
    woolworthsMap.set(p.metric, p);
  }

  const paknsaveMap = new Map<string, ScrapedPrice>();
  for (const p of paknsavePrices) {
    paknsaveMap.set(p.metric, p);
  }

  const today = new Date().toISOString().split("T")[0]!;
  const results: CollectorResult[] = [];

  for (const metric of GROCERY_METRICS) {
    const wPrice = woolworthsMap.get(metric);
    const pPrice = paknsaveMap.get(metric);

    let averagePrice: number | null = null;
    let sources: string[] = [];

    if (wPrice && pPrice) {
      averagePrice =
        Math.round(((wPrice.price + pPrice.price) / 2) * 100) / 100;
      sources = [wPrice.source, pPrice.source];
    } else if (wPrice) {
      averagePrice = wPrice.price;
      sources = [wPrice.source];
    } else if (pPrice) {
      averagePrice = pPrice.price;
      sources = [pPrice.source];
    }

    if (averagePrice === null) {
      console.warn(`[groceries] No price available for ${metric}`);
    } else {
      results.push({
        metric,
        value: averagePrice,
        unit: "nzd",
        date: today,
        source: sources.join(", "),
        metadata: buildMetadata(wPrice, pPrice),
      });
      console.log(
        `[groceries] ${metric}: $${averagePrice} (avg from ${sources.join(" + ")})`
      );
    }
  }

  console.log(
    `[groceries] Total: ${results.length}/${GROCERY_METRICS.length} grocery prices collected`
  );
  return results;
}

function buildMetadata(
  w: ScrapedPrice | undefined,
  p: ScrapedPrice | undefined
): string {
  const parts: string[] = [];
  if (w) {
    parts.push(`woolworths: $${w.price} (${w.productName})`);
  }
  if (p) {
    parts.push(`paknsave: $${p.price} (${p.productName})`);
  }
  return parts.join("; ");
}
