function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a date cell from an XLSX file into an ISO date string (YYYY-MM-DD).
 * Handles Excel serial dates, Date objects, and string dates.
 */
export function parseDateCell(cell: unknown): string | null {
  if (cell == null) {
    return null;
  }

  if (typeof cell === "number") {
    return toDateOnly(new Date(Date.UTC(1899, 11, 30 + Math.floor(cell))));
  }

  if (cell instanceof Date) {
    return toDateOnly(cell);
  }

  if (typeof cell === "string") {
    const parsed = new Date(`${cell}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateOnly(parsed);
    }
  }

  return null;
}

/**
 * Parse a month-year cell (e.g., Excel serial date representing a month)
 * into an ISO date string for the last day of that month.
 */
export function parseMonthCell(cell: unknown): string | null {
  if (cell == null) {
    return null;
  }

  let date: Date | null = null;

  if (typeof cell === "number") {
    date = new Date(Date.UTC(1899, 11, 30 + Math.floor(cell)));
  } else if (cell instanceof Date) {
    date = cell;
  } else if (typeof cell === "string") {
    const parsed = new Date(`${cell}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date) {
    return null;
  }

  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  );
  return toDateOnly(lastDay);
}
