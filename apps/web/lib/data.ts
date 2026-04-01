import type { MetricKey } from "@workspace/db";
import { METRIC_META } from "@workspace/db";

export function formatValue(metric: MetricKey, value: number): string {
  const meta = METRIC_META[metric];
  switch (meta.unit) {
    case "nzd":
      // Smart formatting: $795K for large values, $4.91 for small
      if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(1)}M`;
      }
      if (value >= 10_000) {
        return `$${Math.round(value / 1000)}K`;
      }
      return `$${value.toFixed(2)}`;
    case "nzd_per_litre":
      return `$${value.toFixed(2)}/L`;
    case "nzd_per_kwh":
      return `$${value.toFixed(2)}/kWh`;
    case "nzd_per_week":
      return `$${value.toFixed(0)}/wk`;
    case "nzd_per_hour":
      return `$${value.toFixed(2)}/hr`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(4);
    case "index":
      return value.toLocaleString("en-NZ", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    default:
      return value.toString();
  }
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function computeChange(
  series: { date: string; value: number }[],
  periodDays: number
): { label: string; type: "up" | "down" | "neutral" } {
  if (series.length < 2) {
    return { label: "\u2014", type: "neutral" };
  }

  const current = series[series.length - 1]!;
  const cutoffDate = new Date(
    new Date(current.date).getTime() - periodDays * 86_400_000
  )
    .toISOString()
    .split("T")[0]!;

  // Find the closest data point to the comparison date
  const previous = series.reduce((closest, point) => {
    if (!closest) {
      return point;
    }
    const closestDiff = Math.abs(
      new Date(closest.date).getTime() - new Date(cutoffDate).getTime()
    );
    const pointDiff = Math.abs(
      new Date(point.date).getTime() - new Date(cutoffDate).getTime()
    );
    return pointDiff < closestDiff ? point : closest;
  }, series[0]!);

  const pctChange =
    ((current.value - previous.value) / Math.abs(previous.value)) * 100;
  if (Math.abs(pctChange) < 0.05) {
    return { label: "0.0%", type: "neutral" };
  }

  const arrow = pctChange > 0 ? "\u25B2" : "\u25BC";
  return {
    label: `${arrow} ${Math.abs(pctChange).toFixed(1)}%`,
    type: pctChange > 0 ? "up" : "down",
  };
}

export function getDateRange(months: number): { from: string; to: string } {
  const to = new Date().toISOString().split("T")[0]!;
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - months);
  const from = fromDate.toISOString().split("T")[0]!;
  return { from, to };
}

export function getOneYearAgo(): string {
  return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;
}

/** Earliest possible date for chart queries — covers all backfilled data. */
export function getAllTimeStart(): string {
  return "1970-01-01";
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 2) {
    return "Yesterday";
  }
  return `${diffDays} days ago`;
}
