"use client";

import { useState } from "react";
import { AreaChartSection } from "@/components/charts/area-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { TrendLegend } from "@/components/trend-legend";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

const TREND_COLORS = {
  rising: "oklch(0.637 0.237 25.331)",
  falling: "oklch(0.627 0.194 149.214)",
  stable: "oklch(0.556 0.000 0)",
};

function getTrendColor(data: { value: number }[]): string {
  if (data.length < 2) {
    return TREND_COLORS.stable;
  }
  const recent = data.slice(-7);
  const recentAvg = recent.reduce((s, d) => s + d.value, 0) / recent.length;
  const earlier = data.slice(0, Math.min(30, data.length));
  const earlierAvg = earlier.reduce((s, d) => s + d.value, 0) / earlier.length;
  const change = (recentAvg - earlierAvg) / earlierAvg;
  if (change > 0.02) {
    return TREND_COLORS.rising;
  }
  if (change < -0.02) {
    return TREND_COLORS.falling;
  }
  return TREND_COLORS.stable;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface GroceryChartsProps {
  items: { label: string; data: TimeSeriesPoint[] }[];
}

export function GroceryCharts({ items }: GroceryChartsProps) {
  const [range, setRange] = useState<TimeRange>("1y");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <TrendLegend colors={TREND_COLORS} />
        <TimeRangeSelector
          onChange={setRange}
          ranges={["30d", "90d", "1y"]}
          value={range}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const filtered = filterByRange(item.data, range);
          return (
            <div key={item.label}>
              <h4 className="mb-2 font-medium text-[#555] text-sm">
                {item.label}
              </h4>
              <AreaChartSection
                color={getTrendColor(filtered)}
                data={filtered}
                height={160}
                valueFormat="currency"
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
