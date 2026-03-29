import * as XLSX from "xlsx";
import type { CollectorResult } from "../collectors/types";

/**
 * Load the first sheet of an XLSX buffer as a 2D array of rows.
 */
export function loadSheet(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("XLSX has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("XLSX sheet not found");
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}

/**
 * Search the first N rows for a row matching any of the given patterns.
 * Returns the row index and the row itself.
 */
export function findHeaderRow(
  data: unknown[][],
  patterns: (string | RegExp)[],
  maxRows = 20
): { rowIndex: number; row: unknown[] } {
  for (let i = 0; i < Math.min(data.length, maxRows); i++) {
    const row = data[i];
    if (!row) {
      continue;
    }

    const matches = row.some((cell) => {
      if (typeof cell !== "string") {
        return false;
      }
      return patterns.some((pattern) =>
        pattern instanceof RegExp ? pattern.test(cell) : cell.includes(pattern)
      );
    });

    if (matches) {
      return { rowIndex: i, row };
    }
  }

  const preview = data
    .slice(0, 5)
    .map((r) => JSON.stringify(r)?.slice(0, 120))
    .join("\n");
  throw new Error(
    `Could not find header row matching ${JSON.stringify(patterns)}. First 5 rows:\n${preview}`
  );
}

/**
 * Given a header row and a column mapping (header pattern -> metric key),
 * find the column indices.
 */
export function findColumns(
  row: unknown[],
  columnMap: Record<string, string>,
  matchMode: "exact" | "includes" | "regex" = "exact"
): Array<{ col: number; key: string; metric: string }> {
  const results: Array<{ col: number; key: string; metric: string }> = [];

  for (let j = 0; j < row.length; j++) {
    const header = String(row[j] ?? "").trim();

    for (const [pattern, metric] of Object.entries(columnMap)) {
      if (!metric) {
        continue;
      }

      let matched = false;
      if (matchMode === "exact") {
        matched = header === pattern;
      } else if (matchMode === "includes") {
        matched = header.toLowerCase().includes(pattern.toLowerCase());
      } else if (matchMode === "regex") {
        matched = new RegExp(pattern, "i").test(header);
      }

      if (matched) {
        results.push({ col: j, key: pattern, metric });
      }
    }
  }

  return results;
}

/**
 * Skip metadata rows (like "Notes", "Unit", "Series Id") after the header
 * by checking if the first cell looks like a non-date string.
 * Returns the index of the first data row.
 */
export function findDataStartRow(
  data: unknown[][],
  afterRow: number,
  maxSearch = 10
): number {
  let dataStartIndex = afterRow + 1;

  for (
    let i = afterRow + 1;
    i < Math.min(data.length, afterRow + maxSearch);
    i++
  ) {
    const row = data[i];
    if (!row) {
      continue;
    }
    const firstCell = row[0];
    // Skip rows like "Notes", "Unit", "Series Id"
    if (typeof firstCell === "string" && !firstCell.match(/^\d/)) {
      dataStartIndex = i + 1;
      continue;
    }
    break;
  }

  return dataStartIndex;
}

/**
 * Validate and extract a numeric value from a cell.
 * Returns null for empty/string/NaN values.
 */
export function extractNumericValue(cell: unknown): number | null {
  if (cell == null || cell === "" || typeof cell === "string") {
    return null;
  }
  const num = Number(cell);
  if (Number.isNaN(num)) {
    return null;
  }
  return num;
}

export interface XlsxSheetConfig {
  buffer: Buffer;
  /** Header text -> metric key */
  columnMap: Record<string, string>;
  columnMatchMode?: "exact" | "includes" | "regex";
  /** Column index for dates, defaults to 0 */
  dateColumnIndex?: number;
  dateParseFn: (cell: unknown) => string | null;
  /** Patterns to find the header row */
  headerPatterns: (string | RegExp)[];
  /** Skip metadata rows like "Notes", "Unit", "Series Id" after the header. Defaults to true. */
  skipMetadataRows?: boolean;
  source: string;
  unit: string;
}

/**
 * Main entry point: config-driven XLSX sheet parser.
 * Combines loadSheet, findHeaderRow, findColumns, findDataStartRow,
 * and extractNumericValue into a single declarative call.
 */
export function parseXlsxSheet(config: XlsxSheetConfig): CollectorResult[] {
  const {
    buffer,
    headerPatterns,
    columnMap,
    columnMatchMode = "exact",
    unit,
    source,
    dateParseFn,
    dateColumnIndex = 0,
    skipMetadataRows = true,
  } = config;

  const data = loadSheet(buffer);
  const { rowIndex: headerRowIndex, row: headerRow } = findHeaderRow(
    data,
    headerPatterns
  );

  const metricCols = findColumns(headerRow, columnMap, columnMatchMode);

  if (metricCols.length === 0) {
    throw new Error(
      `No matching columns found in header row. Header: ${JSON.stringify(headerRow)}`
    );
  }

  const dataStartIndex = skipMetadataRows
    ? findDataStartRow(data, headerRowIndex)
    : headerRowIndex + 1;

  const results: CollectorResult[] = [];

  for (let i = dataStartIndex; i < data.length; i++) {
    const row = data[i];
    if (!row?.[dateColumnIndex]) {
      continue;
    }

    const isoDate = dateParseFn(row[dateColumnIndex]);
    if (!isoDate) {
      continue;
    }

    for (const { col, metric } of metricCols) {
      const num = extractNumericValue(row[col]);
      if (num === null) {
        continue;
      }

      results.push({
        metric: metric as CollectorResult["metric"],
        value: num,
        unit,
        date: isoDate,
        source,
      });
    }
  }

  return results;
}
