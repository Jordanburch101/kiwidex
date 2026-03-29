import { loadSheet } from "../../lib/xlsx-parser";
import type { CollectorResult } from "../types";

const SERIES_ID_ROW = 4;
const DATA_START_ROW = 5;
const DATE_COLUMN = 0;

interface MSeriesColumn {
  metric: CollectorResult["metric"];
  seriesId: string;
  unit: string;
}

/**
 * Parse a single column from an RBNZ M-series XLSX file.
 *
 * M-series files have a fixed layout:
 *   Row 0: Group label
 *   Row 1: Sub-label
 *   Row 2: Notes (nulls)
 *   Row 3: Unit row
 *   Row 4: Series ID row (e.g., "CPI.Q.C.iay")
 *   Row 5+: Data rows. Column 0 is date (ISO timestamp string), remaining columns are values.
 */
function parseMSeriesColumn(
  data: unknown[][],
  column: MSeriesColumn,
  source: string
): CollectorResult[] {
  const seriesIdRow = data[SERIES_ID_ROW];
  if (!seriesIdRow) {
    throw new Error(`Row ${SERIES_ID_ROW} (Series ID row) not found in sheet`);
  }

  const colIndex = seriesIdRow.findIndex(
    (cell) => String(cell ?? "").trim() === column.seriesId
  );

  if (colIndex === -1) {
    throw new Error(
      `Series ID "${column.seriesId}" not found in row ${SERIES_ID_ROW}. ` +
        `Available: ${seriesIdRow
          .map((c) => String(c ?? ""))
          .filter(Boolean)
          .join(", ")}`
    );
  }

  const results: CollectorResult[] = [];

  for (let i = DATA_START_ROW; i < data.length; i++) {
    const row = data[i];
    if (!row) {
      continue;
    }

    const dateCell = row[DATE_COLUMN];
    if (dateCell == null || dateCell === "") {
      continue;
    }

    const isoDate = extractDate(dateCell);
    if (!isoDate) {
      continue;
    }

    const valueCell = row[colIndex];
    if (
      valueCell == null ||
      valueCell === "" ||
      typeof valueCell === "string"
    ) {
      continue;
    }

    const num = Number(valueCell);
    if (Number.isNaN(num)) {
      continue;
    }

    results.push({
      metric: column.metric,
      value: num,
      unit: column.unit,
      date: isoDate,
      source,
    });
  }

  return results;
}

/**
 * Extract YYYY-MM-DD from an ISO timestamp string, Date object, or Excel serial number.
 */
function extractDate(cell: unknown): string | null {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }

  if (typeof cell === "string") {
    // Handle ISO timestamps like "1988-03-30T12:00:00.000Z"
    const match = cell.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) {
      return match[1];
    }
  }

  if (typeof cell === "number") {
    // Excel serial date
    const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(cell)));
    return date.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Parse multiple columns from an RBNZ M-series XLSX buffer.
 * Each column is identified by its Series ID in row 4.
 */
export function parseMSeriesFile(
  buffer: Buffer,
  columns: MSeriesColumn[],
  source: string
): CollectorResult[] {
  const data = loadSheet(buffer);
  return columns.flatMap((col) => parseMSeriesColumn(data, col, source));
}
