export type TimeRange = "30d" | "90d" | "1y";

export function filterByRange<T extends { date: string }>(
  data: T[],
  range: TimeRange
): T[] {
  if (data.length === 0) {
    return data;
  }
  const latest = new Date(data.at(-1)!.date);
  const RANGE_DAYS: Record<TimeRange, number> = {
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  const days = RANGE_DAYS[range];
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}
