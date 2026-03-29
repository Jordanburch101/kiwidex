import { parseMonthCell } from "../../lib/date-utils";
import { parseXlsxSheet } from "../../lib/xlsx-parser";
import type { CollectorResult } from "../types";

const SOURCE_URL =
  "https://www.rbnz.govt.nz/statistics/series/exchange-and-interest-rates/new-residential-mortgage-standard-interest-rates";

const COLUMN_MAP: Record<string, CollectorResult["metric"]> = {
  floating: "mortgage_floating",
  "1 year": "mortgage_1yr",
  "2 year": "mortgage_2yr",
};

export function parseMortgageRates(buffer: Buffer): CollectorResult[] {
  return parseXlsxSheet({
    buffer,
    headerPatterns: [/floating/i],
    columnMap: COLUMN_MAP,
    columnMatchMode: "includes",
    unit: "percent",
    source: SOURCE_URL,
    dateParseFn: parseMonthCell,
    skipMetadataRows: false,
  });
}
