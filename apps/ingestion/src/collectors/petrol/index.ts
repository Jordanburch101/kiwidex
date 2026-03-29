import type { CollectorResult } from "../types";
import { collectGaspyLive } from "./gaspy";
import { collectMbieHistorical } from "./mbie";

/**
 * Petrol collector: combines Gaspy (live national averages) with
 * MBIE (weekly historical) for comprehensive fuel price data.
 *
 * Gaspy provides real-time crowdsourced prices — ideal for frequent collection.
 * MBIE provides official weekly board prices — ideal for historical backfill.
 */
export default async function collectPetrol(): Promise<CollectorResult[]> {
  const results: CollectorResult[] = [];
  const errors: string[] = [];

  // Gaspy: live current prices (fast, plain fetch)
  try {
    const gaspy = await collectGaspyLive();
    results.push(...gaspy);
  } catch (e) {
    const msg = `[petrol] Gaspy failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  // MBIE: weekly historical data (larger CSV download)
  try {
    const mbie = await collectMbieHistorical();
    results.push(...mbie);
  } catch (e) {
    const msg = `[petrol] MBIE failed: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    errors.push(msg);
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(`All petrol sources failed:\n${errors.join("\n")}`);
  }

  console.log(`[petrol] Total: ${results.length} data points collected`);
  return results;
}
