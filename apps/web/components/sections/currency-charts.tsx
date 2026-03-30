"use client";

import { useState } from "react";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";
import { CURRENCY_COLORS } from "@/lib/colors";

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
          { key: "usd", color: CURRENCY_COLORS.nzd_usd, label: "NZD/USD" },
          { key: "aud", color: CURRENCY_COLORS.nzd_aud, label: "NZD/AUD" },
          { key: "eur", color: CURRENCY_COLORS.nzd_eur, label: "NZD/EUR" },
        ]}
        valueFormat="ratio"
      />
    </>
  );
}
