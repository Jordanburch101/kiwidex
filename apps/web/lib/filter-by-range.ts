export type TimeRange = "30d" | "90d" | "1y" | "5y" | "10y" | "all";

/** Max data points before downsampling kicks in. */
const MAX_POINTS = 500;

export function filterByRange<T extends { date: string }>(
  data: T[],
  range: TimeRange
): T[] {
  if (data.length === 0) {
    return data;
  }

  let filtered: T[];
  if (range === "all") {
    filtered = data;
  } else {
    const latest = new Date(data.at(-1)!.date);
    const RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = {
      "30d": 30,
      "90d": 90,
      "1y": 365,
      "5y": 1825,
      "10y": 3650,
    };
    const days = RANGE_DAYS[range];
    const cutoff = new Date(latest);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    filtered = data.filter((d) => d.date >= cutoffStr);
  }

  if (filtered.length <= MAX_POINTS) {
    return filtered;
  }

  // Downsample by picking evenly spaced points, always keeping first and last
  const step = (filtered.length - 1) / (MAX_POINTS - 1);
  const result: T[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    result.push(filtered[Math.round(i * step)]!);
  }
  return result;
}
