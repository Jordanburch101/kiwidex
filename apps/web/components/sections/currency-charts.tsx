"use client";

import { useState } from "react";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface FxPoint {
  aud?: number;
  date: string;
  eur?: number;
  usd?: number;
}

interface CurrencyChartsProps {
  data: FxPoint[];
}

export function CurrencyCharts({ data }: CurrencyChartsProps) {
  const [range, setRange] = useState<TimeRange>("1y");

  return (
    <>
      <div className="mb-6 flex justify-end">
        <TimeRangeSelector onChange={setRange} value={range} />
      </div>
      <MultiLineChart
        data={filterByRange(data, range)}
        height={240}
        lines={[
          { key: "usd", color: "#c44", label: "NZD/USD" },
          { key: "aud", color: "#3a8a3a", label: "NZD/AUD" },
          { key: "eur", color: "#e68a00", label: "NZD/EUR" },
        ]}
        valueFormat="ratio"
      />
    </>
  );
}
