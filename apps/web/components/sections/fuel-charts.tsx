"use client";

import { useState } from "react";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface FuelPoint {
  date: string;
  diesel?: number;
  petrol91?: number;
  petrol95?: number;
}

interface FuelChartsProps {
  data: FuelPoint[];
}

export function FuelCharts({ data }: FuelChartsProps) {
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
          { key: "petrol91", color: "#c44", label: "91 Octane" },
          { key: "petrol95", color: "#e68a00", label: "95 Octane" },
          { key: "diesel", color: "#3a8a3a", label: "Diesel" },
        ]}
        valueFormat="currency"
      />
    </>
  );
}
