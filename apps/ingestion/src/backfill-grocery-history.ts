/**
 * One-time backfill script to import historical grocery prices from Stats NZ.
 *
 * Source: Stats NZ "Selected Price Indexes" CSV
 * Contains monthly weighted average retail prices from 2006 onwards.
 *
 * Usage: DATABASE_URL=file:../../packages/db/local.db bun run src/backfill-grocery-history.ts
 */
import { bulkInsert, db } from "@workspace/db";
import type { MetricKey } from "@workspace/db/metrics";

const CSV_URL =
  "https://www.stats.govt.nz/assets/Uploads/Selected-price-indexes/Selected-price-indexes-February-2026/Download-data/selected-price-indexes-february-2026.csv";

// Stats NZ series references → our metric keys
const SERIES_MAP: Record<string, { metric: MetricKey; label: string }> = {
  "CPIM.SAP0127": { metric: "milk", label: "Milk 2L" },
  "CPIM.SAP0130": { metric: "eggs", label: "Eggs dozen" },
  "CPIM.SAP0149": { metric: "bread", label: "Bread white loaf" },
  "CPIM.SAP0131": { metric: "butter", label: "Butter 500g" },
  "CPIM.SAP0129": { metric: "cheese", label: "Cheese mild" },
  "CPIM.SAP0101": { metric: "bananas", label: "Bananas per kg" },
};

function parseStatsNzPeriod(period: string): string | null {
  // Format: "YYYY.MM" but October is "YYYY.1" not "YYYY.10"
  // Actually the format is YYYY.MM where MM can be 1-12 (no leading zero)
  const match = period.match(/^(\d{4})\.(\d{1,2})$/);
  if (!match) return null;
  const year = match[1]!;
  const month = match[2]!.padStart(2, "0");
  // Use last day of month for consistency with other collectors
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return `${year}-${month}-${lastDay.toString().padStart(2, "0")}`;
}

async function main() {
  console.log("Downloading Stats NZ Selected Price Indexes CSV...");
  const response = await fetch(CSV_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split("\n");
  console.log(`Downloaded ${lines.length} lines`);

  // Parse header
  const header = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const refIdx = header.indexOf("Series_reference");
  const periodIdx = header.indexOf("Period");
  const valueIdx = header.indexOf("Data_value");
  const unitsIdx = header.indexOf("UNITS");

  if (refIdx === -1 || periodIdx === -1 || valueIdx === -1) {
    throw new Error(`Unexpected CSV header: ${header.join(", ")}`);
  }

  // Only keep data from last 2 years for the backfill
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
  const cutoffStr = cutoffDate.toISOString().split("T")[0]!;

  const results: Array<{
    metric: string;
    value: number;
    unit: string;
    date: string;
    source: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // Simple CSV parse (fields may be quoted)
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

    const seriesRef = cols[refIdx]?.trim();
    const period = cols[periodIdx]?.trim();
    const rawValue = cols[valueIdx]?.trim();
    const units = cols[unitsIdx]?.trim();

    // Only want dollar prices, not index values
    if (units !== "Dollars") continue;

    const mapping = seriesRef ? SERIES_MAP[seriesRef] : undefined;
    if (!mapping || !period || !rawValue) continue;

    const value = Number(rawValue);
    if (Number.isNaN(value) || value <= 0) continue;

    const date = parseStatsNzPeriod(period);
    if (!date || date < cutoffStr) continue;

    results.push({
      metric: mapping.metric,
      value,
      unit: "nzd",
      date,
      source: "stats-nz-fpi",
    });
  }

  // Show what we found
  const byCat: Record<string, number> = {};
  for (const r of results) {
    byCat[r.metric] = (byCat[r.metric] ?? 0) + 1;
  }
  console.log(`\nFound ${results.length} data points:`);
  for (const [metric, count] of Object.entries(byCat)) {
    const latest = results.filter((r) => r.metric === metric).sort((a, b) => b.date.localeCompare(a.date))[0];
    console.log(`  ${metric}: ${count} months (latest: $${latest?.value} on ${latest?.date})`);
  }

  // Insert into DB
  console.log("\nInserting into database...");
  await bulkInsert(db, results);
  console.log("Done!");
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
