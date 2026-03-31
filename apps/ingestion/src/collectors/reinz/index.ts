import type { CollectorResult } from "../types";

const API_URL = "https://www.interest.co.nz/chart-data/get-csv-data";
const SOURCE_URL =
  "https://www.interest.co.nz/charts/real-estate/median-house-price";

interface ChartResponse {
  [nid: string]: {
    csv_data: [number, number][][];
  };
}

/**
 * Get the last day of the month for a given date.
 */
function getMonthEndDate(date: Date): string {
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  );
  return lastDay.toISOString().slice(0, 10);
}

/**
 * REINZ collector: fetches historical national median house prices from
 * interest.co.nz's chart data API (sourced from REINZ).
 *
 * Returns monthly data points from 1992 to present.
 */
export default async function collectREINZ(): Promise<CollectorResult[]> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: "nids[]=79390",
  });

  if (!response.ok) {
    throw new Error(`interest.co.nz chart API: HTTP ${response.status}`);
  }

  const data: ChartResponse = await response.json();
  const chartData = data["79390"];

  if (!chartData?.csv_data?.[0]) {
    throw new Error("interest.co.nz chart API: unexpected response structure");
  }

  // First series (index 0) is NZ Total
  const nzTotal = chartData.csv_data[0];
  const results: CollectorResult[] = [];

  for (const [timestampMs, price] of nzTotal) {
    if (price == null || typeof price !== "number") {
      continue;
    }

    // Sanity check: median house price should be between $50k and $5M
    if (price < 50_000 || price > 5_000_000) {
      continue;
    }

    const date = new Date(timestampMs);
    const isoDate = getMonthEndDate(date);

    results.push({
      metric: "house_price_median",
      value: price,
      unit: "nzd",
      date: isoDate,
      source: SOURCE_URL,
    });
  }

  if (results.length === 0) {
    throw new Error("REINZ collector: no valid data points found");
  }

  console.log(
    `[reinz] ${results.length} data points (${results[0]!.date} → ${results.at(-1)!.date})`
  );
  return results;
}
