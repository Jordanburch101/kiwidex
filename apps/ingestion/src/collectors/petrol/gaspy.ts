import type { CollectorResult } from "../types";

const GASPY_URL =
  "https://gaspy-datamine-stats.firebaseio.com/datamine/Averages.json";

const GASPY_MAP: Record<string, CollectorResult["metric"]> = {
  "91": "petrol_91",
  "95": "petrol_95",
  Diesel: "petrol_diesel",
};

interface GaspyAverage {
  "28DayChange": number;
  "28DayPercent": number;
  Average: number;
}

/**
 * Fetch live national average fuel prices from Gaspy (crowdsourced).
 * Prices are in NZD cents/litre, converted to NZD/litre.
 * Returns one data point per fuel type for today's date.
 */
export async function collectGaspyLive(): Promise<CollectorResult[]> {
  const response = await fetch(GASPY_URL);
  if (!response.ok) {
    throw new Error(`Gaspy API: HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, GaspyAverage>;
  const today = new Date().toISOString().split("T")[0]!;
  const results: CollectorResult[] = [];

  for (const [key, metric] of Object.entries(GASPY_MAP)) {
    const entry = data[key];
    if (!entry?.Average) {
      continue;
    }

    results.push({
      metric,
      value: Math.round((entry.Average / 100) * 10_000) / 10_000,
      unit: "nzd_per_litre",
      date: today,
      source: GASPY_URL,
    });
  }

  console.log(
    `[petrol/gaspy] ${results.length} live prices: ${results.map((r) => `${r.metric}=$${r.value}`).join(", ")}`
  );
  return results;
}
