import type { CollectorResult } from "../types";

/**
 * em6 Free API — real-time wholesale electricity spot prices by region.
 * Provided by Energy Market Services (Transpower subsidiary).
 * No API key required. Updates every 5 minutes.
 *
 * We collect the current national average (across all 14 grid zones)
 * and store one data point per day. Price is in NZD/MWh.
 *
 * @see https://www.ems.co.nz/services/em6/em6-data-feeds/
 */

const API_URL = "https://api.em6.co.nz/ords/em6/data_api/region/price";

interface Em6PriceItem {
  grid_zone_id: number;
  grid_zone_name: string;
  price: number;
  timestamp: string;
  trading_period: number;
}

interface Em6Response {
  items: Em6PriceItem[];
}

async function fetchWithRetry(
  attempts = 3,
  delayMs = 10_000
): Promise<Em6PriceItem[]> {
  for (let i = 1; i <= attempts; i++) {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`em6 API: HTTP ${response.status}`);
    }

    const data: Em6Response = await response.json();

    if (data.items && data.items.length > 0) {
      return data.items;
    }

    if (i < attempts) {
      console.warn(
        `[electricity-wholesale] em6 API returned no data, retrying in ${delayMs / 1000}s (${i}/${attempts})`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.warn(
    `[electricity-wholesale] em6 API returned no data after ${attempts} attempts — skipping`
  );
  return [];
}

export default async function collectElectricityWholesale(): Promise<
  CollectorResult[]
> {
  const items = await fetchWithRetry();

  if (items.length === 0) {
    return [];
  }

  // Compute national average across all grid zones
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const avgPrice = Math.round((totalPrice / items.length) * 100) / 100;

  // Use today's date (NZ timezone)
  const nzDate = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" })
    .split("T")[0]!;

  console.log(
    `[electricity-wholesale] $${avgPrice.toFixed(2)}/MWh (${(avgPrice / 10).toFixed(2)}c/kWh) across ${items.length} regions`
  );

  return [
    {
      metric: "electricity_wholesale",
      value: avgPrice,
      unit: "nzd_per_mwh",
      date: nzDate,
      source: API_URL,
      metadata: JSON.stringify({
        regions: items.length,
        timestamp: items[0]?.timestamp,
        trading_period: items[0]?.trading_period,
      }),
    },
  ];
}
