import * as XLSX from "xlsx";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/wholesale-interest-rates";

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
 * Parse B2 XLSX for the Official Cash Rate.
 *
 * Actual structure (rows):
 *   0: [null, "Cash rate", "Cash rate", ...]
 *   1: [null, "Official Cash Rate (OCR)", "Overnight Deposit Rate", ...]
 *   2: ["Notes", ...]
 *   3: ["Unit", "%pa", "%pa", ...]
 *   4: ["Series Id", "INM.DP1.N", ...]
 *   5+: [date, ocrValue, ...]
 *
 * The OCR column is found by searching row 1 for "Official Cash Rate (OCR)".
 */
export function parseOCR(buffer: Buffer): CollectorResult[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("B2 XLSX has no sheets");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("B2 XLSX sheet not found");
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find the row containing "Official Cash Rate (OCR)" to identify the OCR column
  let ocrCol = -1;
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? "").trim();
      if (/official cash rate/i.test(cell)) {
        ocrCol = j;
        headerRowIndex = i;
        break;
      }
    }
    if (ocrCol !== -1) break;
  }

  if (headerRowIndex === -1 || ocrCol === -1) {
    throw new Error(
      `Could not find OCR column in B2 XLSX. First 10 rows: ${JSON.stringify(data.slice(0, 10))}`
    );
  }

  // Data rows start after metadata rows. Skip until we find a row whose
  // first cell is a date (not a string label).
  let dataStartIndex = headerRowIndex + 1;
  for (let i = headerRowIndex + 1; i < Math.min(data.length, headerRowIndex + 10); i++) {
    const row = data[i];
    if (!row) continue;
    const firstCell = row[0];
    // Skip rows like "Notes", "Unit", "Series Id"
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

    const val = row[ocrCol];
    if (val == null || val === "" || typeof val === "string") continue;
    const num = Number(val);
    if (isNaN(num)) continue;

    results.push({
      metric: "ocr",
      value: num,
      unit: "percent",
      date: isoDate,
      source: SOURCE_URL,
    });
  }

  return results;
}
