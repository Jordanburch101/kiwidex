import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { bulkInsert } from "./queries";
import { METRIC_META, type MetricKey } from "./metrics";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

const sampleData: Array<{
  metric: MetricKey;
  value: number;
  unit: string;
  date: string;
  source: string;
}> = [
  // Everyday Costs
  { metric: "petrol_91", value: 2.879, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "petrol_95", value: 3.099, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "petrol_diesel", value: 2.159, unit: "nzd_per_litre", date: "2026-03-29", source: "seed" },
  { metric: "milk", value: 3.49, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "eggs", value: 8.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "bread", value: 3.50, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "butter", value: 5.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "cheese", value: 14.99, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "rent_national", value: 590, unit: "nzd_per_week", date: "2026-03-29", source: "seed" },
  { metric: "electricity", value: 0.2850, unit: "nzd_per_kwh", date: "2026-03-29", source: "seed" },
  // Housing
  { metric: "house_price_median", value: 780000, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_floating", value: 8.64, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_1yr", value: 6.35, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "mortgage_2yr", value: 5.99, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "rent_vs_buy", value: 0.039, unit: "ratio", date: "2026-03-29", source: "seed" },
  // Employment & Income
  { metric: "unemployment", value: 5.1, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "median_income", value: 65000, unit: "nzd", date: "2026-03-29", source: "seed" },
  { metric: "wage_growth", value: 3.2, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "minimum_wage", value: 23.15, unit: "nzd_per_hour", date: "2026-03-29", source: "seed" },
  // Macro / Financial
  { metric: "ocr", value: 3.75, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "cpi", value: 2.2, unit: "percent", date: "2026-03-29", source: "seed" },
  { metric: "nzd_usd", value: 0.5680, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "nzd_aud", value: 0.9050, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "nzd_eur", value: 0.5210, unit: "ratio", date: "2026-03-29", source: "seed" },
  { metric: "gdp_growth", value: 0.4, unit: "percent", date: "2026-03-29", source: "seed" },
];

// METRIC_META is imported to validate metric keys exist at compile time
void METRIC_META;

async function main() {
  console.log(`Seeding ${sampleData.length} data points...`);
  await bulkInsert(db, sampleData);
  console.log("Done.");
}

main().catch(console.error);
