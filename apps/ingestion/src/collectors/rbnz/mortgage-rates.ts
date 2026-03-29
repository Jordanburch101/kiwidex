import * as XLSX from "xlsx";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/new-residential-mortgage-standard-interest-rates";

/** Map of header patterns to metric keys. */
const COLUMN_MAP: Record<string, CollectorResult["metric"]> = {
  floating: "mortgage_floating",
  "1 year": "mortgage_1yr",
  "2 year": "mortgage_2yr",
};

function lastDayOfMonthISO(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().split("T")[0]!;
}

/**
 * Parse a monthly date like "Feb 2026" to the last day of that month.
 */
function parseMonthlyDate(cell: unknown): string | null {
  if (cell instanceof Date) {
    return lastDayOfMonthISO(cell);
  }
  if (typeof cell === "number") {
    // Excel serial date
    const date = new Date((cell - 25569) * 86400 * 1000);
    return lastDayOfMonthISO(date);
  }
  if (typeof cell === "string") {
    const d = new Date(cell);
    if (!isNaN(d.getTime())) {
      return lastDayOfMonthISO(d);
    }
  }
  return null;
}

export function parseMortgageRates(buffer: Buffer): CollectorResult[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("B20 XLSX has no sheets");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("B20 XLSX sheet not found");
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find the header row: look for a row containing "Floating" (case-insensitive)
  let headerRowIndex = -1;
  let dateCol = -1;
  const metricCols: { col: number; metric: CollectorResult["metric"] }[] = [];

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (!row) continue;

    const hasFloating = row.some(
      (cell) => typeof cell === "string" && /floating/i.test(cell)
    );

    if (hasFloating) {
      headerRowIndex = i;
      for (let j = 0; j < row.length; j++) {
        const header = String(row[j] ?? "").trim().toLowerCase();

        if (/date/.test(header)) {
          dateCol = j;
        }

        for (const [pattern, metric] of Object.entries(COLUMN_MAP)) {
          if (metric && header.includes(pattern.toLowerCase())) {
            metricCols.push({ col: j, metric });
          }
        }
      }

      // If we didn't find a "Date" column, assume it's column 0
      if (dateCol === -1) {
        dateCol = 0;
      }
      break;
    }
  }

  if (headerRowIndex === -1 || metricCols.length === 0) {
    throw new Error(
      `Could not find header row in B20 mortgage XLSX. First 10 rows: ${JSON.stringify(data.slice(0, 10))}`
    );
  }

  const results: CollectorResult[] = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[dateCol]) continue;

    const isoDate = parseMonthlyDate(row[dateCol]);
    if (!isoDate) continue;

    for (const { col, metric } of metricCols) {
      const val = row[col];
      if (val == null || val === "" || typeof val === "string") continue;
      const num = Number(val);
      if (isNaN(num)) continue;

      results.push({
        metric,
        value: num,
        unit: "percent",
        date: isoDate,
        source: SOURCE_URL,
      });
    }
  }

  return results;
}
