import { db, getLatestValue } from "@workspace/db";
import type { CollectorResult } from "../types";

/**
 * Rent vs Buy collector: derives the rent-to-price ratio from existing DB data.
 *
 * Formula: (weekly_rent * 52) / median_house_price
 *
 * Uses the latest `rent_national` (NZD/week) and `house_price_median` (NZD)
 * already stored in the database. No external HTTP requests are made.
 */
export default async function collectRentVsBuy(): Promise<CollectorResult[]> {
  const rent = await getLatestValue(db, "rent_national");
  const housePrice = await getLatestValue(db, "house_price_median");

  if (!(rent && housePrice) || housePrice.value === 0) {
    console.log("[rent-vs-buy] Missing rent or house price data, skipping");
    return [];
  }

  const annualRent = rent.value * 52;
  const ratio = annualRent / housePrice.value;
  // Use the more recent date of the two inputs
  const date = rent.date > housePrice.date ? rent.date : housePrice.date;

  console.log(
    `[rent-vs-buy] Rent: $${rent.value}/wk, House: $${housePrice.value}, Ratio: ${ratio.toFixed(4)}`
  );

  return [
    {
      metric: "rent_vs_buy",
      value: Number(ratio.toFixed(4)),
      unit: "ratio",
      date,
      source: "derived:rent_national+house_price_median",
    },
  ];
}
