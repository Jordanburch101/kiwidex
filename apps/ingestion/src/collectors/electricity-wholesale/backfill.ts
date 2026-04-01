/**
 * Backfill historical wholesale electricity prices from the EA's
 * FinalEnergyPrices CSVs (daily files on Azure Blob Storage).
 *
 * Usage: bun run apps/ingestion/src/collectors/electricity-wholesale/backfill.ts
 *
 * Data goes back to 2025-03-31. Each CSV has ~11K rows (all nodes × 48
 * trading periods). We compute the daily national average $/MWh.
 */

import { db } from "@workspace/db/client";
import { bulkInsert } from "@workspace/db/queries";

const BLOB_BASE =
  "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices";

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function toIso(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

async function fetchDailyAverage(
  date: Date
): Promise<{ date: string; avg: number } | null> {
  const dateStr = formatDate(date);
  const url = `${BLOB_BASE}/${dateStr}_FinalEnergyPrices.csv`;

  const resp = await fetch(url);
  if (!resp.ok) {
    // Try interim file (for very recent dates)
    const interimUrl = `${BLOB_BASE}/${dateStr}_FinalEnergyPrices_I.csv`;
    const interimResp = await fetch(interimUrl);
    if (!interimResp.ok) {
      return null;
    }
    return parseCsv(await interimResp.text(), date);
  }

  return parseCsv(await resp.text(), date);
}

function parseCsv(
  text: string,
  date: Date
): { date: string; avg: number } | null {
  const lines = text.split("\n");
  if (lines.length < 2) {
    return null;
  }

  // Header: TradingDate,TradingPeriod,PointOfConnection,DollarsPerMegawattHour
  let sum = 0;
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      continue;
    }
    const cols = line.split(",");
    const price = Number(cols[3]);
    if (!Number.isNaN(price)) {
      sum += price;
      count++;
    }
  }

  if (count === 0) {
    return null;
  }

  return {
    date: toIso(date),
    avg: Math.round((sum / count) * 100) / 100,
  };
}

async function main() {
  const start = new Date("2025-03-31");
  const end = new Date();
  end.setDate(end.getDate() - 1); // yesterday (today may not have final data yet)

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
  console.log(
    `Backfilling ${totalDays} days from ${toIso(start)} to ${toIso(end)}...`
  );

  const BATCH_SIZE = 10;
  const results: {
    metric: string;
    value: number;
    unit: string;
    date: string;
    source: string;
  }[] = [];

  // Process in batches to avoid overwhelming the server
  const current = new Date(start);
  let fetched = 0;
  let skipped = 0;

  while (current <= end) {
    const batch: Promise<{ date: string; avg: number } | null>[] = [];
    const batchDates: Date[] = [];

    for (let i = 0; i < BATCH_SIZE && current <= end; i++) {
      batch.push(fetchDailyAverage(new Date(current)));
      batchDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const batchResults = await Promise.all(batch);

    for (const result of batchResults) {
      if (result) {
        results.push({
          metric: "electricity_wholesale",
          value: result.avg,
          unit: "nzd_per_mwh",
          date: result.date,
          source: `${BLOB_BASE}/FinalEnergyPrices`,
        });
        fetched++;
      } else {
        skipped++;
      }
    }

    process.stdout.write(
      `\r  ${fetched} fetched, ${skipped} skipped (${Math.round(((fetched + skipped) / totalDays) * 100)}%)`
    );
  }

  console.log(`\n\nInserting ${results.length} data points...`);

  // Insert in chunks of 50
  for (let i = 0; i < results.length; i += 50) {
    const chunk = results.slice(i, i + 50);
    await bulkInsert(db, chunk);
  }

  console.log("Done!");
}

main().catch(console.error);
