import * as XLSX from "xlsx";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/exchange-rates-and-the-trade-weighted-index";

/**
 * Map column header patterns to metric keys.
 * The B1 XLSX has headers like "NZD/USD", "NZD/GBP", "NZD/AUD", etc.
 */
const COLUMN_MAP: Record<string, CollectorResult["metric"]> = {
  "NZD/USD": "nzd_usd",
  "NZD/AUD": "nzd_aud",
  "NZD/EUR": "nzd_eur",
};

function parseDateCell(cell: unknown): string | null {
  if (cell instanceof Date) {
    return cell.toISOString().split("T")[0]!;
  }
  if (typeof cell === "number") {
    const date = new Date((cell - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0]!;
  }
  if (typeof cell === "string") {
    const d = new Date(cell);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0]!;
    }
  }
  return null;
}

/**
 * Parse B1 XLSX for exchange rates.
 *
 * Actual structure (rows):
 *   0: [null, "TWI", "Exchange rates (quoted per NZ$)", ...]
 *   1: [null, "17 currency basket", "United States dollar", "UK pound sterling", "Australian dollar", ...]
 *   2: ["Notes"]
 *   3: ["Unit", "Index", "NZD/USD", "NZD/GBP", "NZD/AUD", "NZD/JPY", "NZD/EUR", ...]
 *   4: ["Series Id", ...]
 *   5+: [date, value, value, ...]
 */
export function parseExchangeRates(buffer: Buffer): CollectorResult[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("B1 XLSX has no sheets");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("B1 XLSX sheet not found");
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find the header row containing "NZD/USD" — this is the "Unit" row
  let headerRowIndex = -1;
  const metricCols: { col: number; metric: CollectorResult["metric"] }[] = [];

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (!row) continue;

    const hasNzdUsd = row.some(
      (cell) => typeof cell === "string" && cell.includes("NZD/USD")
    );

    if (hasNzdUsd) {
      headerRowIndex = i;
      for (let j = 0; j < row.length; j++) {
        const header = String(row[j] ?? "").trim();
        for (const [pattern, metric] of Object.entries(COLUMN_MAP)) {
          if (metric && header === pattern) {
            metricCols.push({ col: j, metric });
          }
        }
      }
      break;
    }
  }

  if (headerRowIndex === -1 || metricCols.length === 0) {
    throw new Error(
      `Could not find header row in B1 exchange rate XLSX. First 10 rows: ${JSON.stringify(data.slice(0, 10))}`
    );
  }

  // Data rows start after "Series Id" row (headerRowIndex + 2 typically),
  // but we detect by looking for a row whose first cell is a date.
  let dataStartIndex = headerRowIndex + 1;
  for (let i = headerRowIndex + 1; i < Math.min(data.length, headerRowIndex + 5); i++) {
    const row = data[i];
    if (!row) continue;
    const firstCell = row[0];
    // Skip rows like "Series Id"
    if (typeof firstCell === "string" && !firstCell.match(/^\d/)) {
      dataStartIndex = i + 1;
      continue;
    }
    break;
  }

  // Date is always column 0
  const dateCol = 0;
  const results: CollectorResult[] = [];

  for (let i = dataStartIndex; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[dateCol]) continue;

    const isoDate = parseDateCell(row[dateCol]);
    if (!isoDate) continue;

    for (const { col, metric } of metricCols) {
      const val = row[col];
      if (val == null || val === "" || typeof val === "string") continue;
      const num = Number(val);
      if (isNaN(num)) continue;

      results.push({
        metric,
        value: num,
        unit: "ratio",
        date: isoDate,
        source: SOURCE_URL,
      });
    }
  }

  return results;
}
