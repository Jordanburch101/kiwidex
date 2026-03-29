import type { CollectorResult } from "../types";

const CSV_URL =
  "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Retail/RegionalPowerPrices/20250731_AveragePowerUseAndCosts.csv";

/**
 * Electricity collector: fetches the Electricity Authority regional power
 * prices CSV and computes a national average variable rate ($/kWh incl GST)
 * for "Standard user" load type across all regions per date.
 */
export default async function collectElectricity(): Promise<CollectorResult[]> {
  const response = await fetch(CSV_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`EA electricity CSV: HTTP ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n");

  if (lines.length < 2) {
    throw new Error("EA electricity CSV: file appears empty");
  }

  // Parse header
  const header = lines[0]!.split(",").map((h) => h.trim());
  const dateIdx = header.indexOf("Date");
  const loadTypeIdx = header.indexOf("LoadType");
  const variableIdx = header.indexOf("VariableDollarPerkWhInclGST");

  if (dateIdx === -1 || loadTypeIdx === -1 || variableIdx === -1) {
    throw new Error(
      `EA electricity CSV: unexpected header format: ${header.join(", ")}`
    );
  }

  // Accumulate per-date totals for averaging across regions
  const dateAccum = new Map<string, { sum: number; count: number }>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      continue;
    }

    const cols = line.split(",");
    const loadType = cols[loadTypeIdx]?.trim();
    if (loadType !== "Standard user") {
      continue;
    }

    const rawDate = cols[dateIdx]?.trim() ?? "";
    if (!rawDate) {
      continue;
    }

    const rawValue = Number(cols[variableIdx]?.trim());
    if (Number.isNaN(rawValue)) {
      continue;
    }

    // Normalise date to ISO format
    const date = normaliseDate(rawDate);
    if (!date) {
      continue;
    }

    const entry = dateAccum.get(date);
    if (entry) {
      entry.sum += rawValue;
      entry.count += 1;
    } else {
      dateAccum.set(date, { sum: rawValue, count: 1 });
    }
  }

  const results: CollectorResult[] = [];

  for (const [date, { sum, count }] of dateAccum) {
    const avg = Math.round((sum / count) * 10_000) / 10_000;
    results.push({
      metric: "electricity",
      value: avg,
      unit: "nzd_per_kwh",
      date,
      source: CSV_URL,
    });
  }

  // Sort by date ascending
  results.sort((a, b) => a.date.localeCompare(b.date));

  if (results.length === 0) {
    throw new Error("EA electricity CSV: no standard user rows found");
  }

  console.log(`[electricity] ${results.length} data points collected`);
  return results;
}

/**
 * Normalise a date string to ISO YYYY-MM-DD.
 * Handles YYYY-MM-DD, DD/MM/YYYY, and M/D/YYYY formats.
 */
function normaliseDate(raw: string): string | null {
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // DD/MM/YYYY
  const ddmm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmm) {
    const [, dd, mm, yyyy] = ddmm;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }

  // Try parsing as a generic date
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}
