import type { MetricKey } from "@workspace/db";
import { METRIC_META } from "@workspace/db";

export function formatValue(metric: MetricKey, value: number): string {
  const meta = METRIC_META[metric];
  switch (meta.unit) {
    case "nzd":
      return `$${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "nzd_per_litre":
      return `$${value.toFixed(3)}/L`;
    case "nzd_per_kwh":
      return `$${value.toFixed(4)}/kWh`;
    case "nzd_per_week":
      return `$${value.toFixed(0)}/wk`;
    case "nzd_per_hour":
      return `$${value.toFixed(2)}/hr`;
    case "percent":
      return `${value.toFixed(2)}%`;
    case "ratio":
      return value.toFixed(4);
    default:
      return value.toString();
  }
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function computeChange(
  current: number,
  previous: number
): { label: string; type: "up" | "down" | "neutral" } {
  if (previous === 0) {
    return { label: "—", type: "neutral" };
  }
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pctChange) < 0.01) {
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

export function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
}
