"use client";

import { useState } from "react";
import { AreaChartSection } from "@/components/charts/area-chart";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { LABOUR_COLORS } from "@/lib/colors";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface WageVsCpiPoint {
  cpi?: number;
  date: string;
  wages?: number;
  [key: string]: string | number | undefined;
}

interface LabourChartsProps {
  medianIncome: TimeSeriesPoint[];
  unemployment: TimeSeriesPoint[];
  wageVsCpi: WageVsCpiPoint[];
}

export function LabourCharts({
  wageVsCpi,
  unemployment,
  medianIncome,
}: LabourChartsProps) {
  const [range, setRange] = useState<TimeRange>("10y");

  return (
    <>
      <div className="mb-6 flex justify-end">
        <TimeRangeSelector onChange={setRange} value={range} />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Wage Growth vs CPI
          </h4>
          <MultiLineChart
            data={filterByRange(wageVsCpi, range)}
            height={180}
            lines={[
              {
                key: "wages",
                color: LABOUR_COLORS.wageGrowth,
                label: "Wage Growth",
              },
              { key: "cpi", color: LABOUR_COLORS.cpi, label: "CPI" },
            ]}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Unemployment Rate
          </h4>
          <AreaChartSection
            color={LABOUR_COLORS.unemployment}
            data={filterByRange(unemployment, range)}
            height={180}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Average Income
          </h4>
          <AreaChartSection
            color="oklch(0.596 0.145 163.225)"
            data={filterByRange(medianIncome, range)}
            height={180}
            valueFormat="currency_k"
          />
        </div>
      </div>
    </>
  );
}
