import { parseDateCell } from "../../lib/date-utils";
import { parseXlsxSheet } from "../../lib/xlsx-parser";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/wholesale-interest-rates";

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
  return parseXlsxSheet({
    buffer,
    headerPatterns: [/official cash rate/i],
    columnMap: { "official cash rate": "ocr" },
    columnMatchMode: "regex",
    unit: "percent",
    source: SOURCE_URL,
    dateParseFn: parseDateCell,
  });
}
