import { parseDateCell } from "../../lib/date-utils";
import { parseXlsxSheet } from "../../lib/xlsx-parser";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/exchange-rates-and-the-trade-weighted-index";

const COLUMN_MAP: Record<string, CollectorResult["metric"]> = {
  "NZD/USD": "nzd_usd",
  "NZD/AUD": "nzd_aud",
  "NZD/EUR": "nzd_eur",
};

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
  return parseXlsxSheet({
    buffer,
    headerPatterns: ["NZD/USD"],
    columnMap: COLUMN_MAP,
    columnMatchMode: "exact",
    unit: "ratio",
    source: SOURCE_URL,
    dateParseFn: parseDateCell,
  });
}
