import type { CollectorResult } from "../types";

const CSV_URL =
  "https://www.mbie.govt.nz/assets/Data-Files/Energy/Weekly-fuel-price-monitoring/weekly-table.csv";

const FUEL_MAP: Record<string, CollectorResult["metric"]> = {
  "Regular Petrol": "petrol_91",
  "Premium Petrol 95R": "petrol_95",
  Diesel: "petrol_diesel",
};

function parseDDMMYYYY(raw: string): string | null {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fetch historical weekly fuel prices from MBIE (government, CSV).
 * National average board prices for 91, 95, diesel — weekly since 2004.
 * Values converted from NZD cents/litre to NZD/litre.
 */
export async function collectMbieHistorical(): Promise<CollectorResult[]> {
  const response = await fetch(CSV_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`MBIE petrol CSV: HTTP ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n");

  if (lines.length < 2) {
    throw new Error("MBIE petrol CSV: file appears empty");
  }

  const header = lines[0]!.split(",").map((h) => h.trim());
  const dateIdx = header.indexOf("Date");
  const fuelIdx = header.indexOf("Fuel");
  const variableIdx = header.indexOf("Variable");
  const valueIdx = header.indexOf("Value");

  if (
    dateIdx === -1 ||
    fuelIdx === -1 ||
    variableIdx === -1 ||
    valueIdx === -1
  ) {
    throw new Error(
      `MBIE petrol CSV: unexpected header format: ${header.join(", ")}`
    );
  }

  const results: CollectorResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      continue;
    }

    const cols = line.split(",");
    const variable = cols[variableIdx]?.trim();
    if (variable !== "Board price") {
      continue;
    }

    const fuelName = cols[fuelIdx]?.trim() ?? "";
    const metric = FUEL_MAP[fuelName];
    if (!metric) {
      continue;
    }

    const rawDate = cols[dateIdx]?.trim() ?? "";
    const date = parseDDMMYYYY(rawDate);
    if (!date) {
      continue;
    }

    const rawValue = Number(cols[valueIdx]?.trim());
    if (Number.isNaN(rawValue)) {
      continue;
    }

    const value = Math.round((rawValue / 100) * 10_000) / 10_000;

    results.push({
      metric,
      value,
      unit: "nzd_per_litre",
      date,
      source: CSV_URL,
    });
  }

  console.log(`[petrol/mbie] ${results.length} historical data points`);
  return results;
}
