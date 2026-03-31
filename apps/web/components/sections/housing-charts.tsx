"use client";

import { useState } from "react";
import { AreaChartSection } from "@/components/charts/area-chart";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { HOUSING_COLORS } from "@/lib/colors";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface MortgagePoint {
  date: string;
  floating?: number;
  oneYear?: number;
  twoYear?: number;
  [key: string]: string | number | undefined;
}

interface HousingChartsProps {
  housePrice: TimeSeriesPoint[];
  housePriceIndex: TimeSeriesPoint[];
  mortgageData: MortgagePoint[];
}

export function HousingCharts({
  housePrice,
  housePriceIndex,
  mortgageData,
}: HousingChartsProps) {
  const [range, setRange] = useState<TimeRange>("1y");

  return (
    <>
      <div className="mb-6 flex justify-end">
        <TimeRangeSelector onChange={setRange} value={range} />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            House Price Index
          </h4>
          <AreaChartSection
            color="oklch(0.508 0.118 165.612)"
            data={filterByRange(housePriceIndex, range)}
            height={200}
            valueFormat="number"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Median House Price
          </h4>
          <AreaChartSection
            color="oklch(0.588 0.138 165.612)"
            data={filterByRange(housePrice, range)}
            height={200}
            valueFormat="currency_k"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Mortgage Rates
          </h4>
          <MultiLineChart
            data={filterByRange(mortgageData, range)}
            height={200}
            lines={[
              {
                key: "floating",
                color: HOUSING_COLORS.floating,
                label: "Floating",
              },
              {
                key: "oneYear",
                color: HOUSING_COLORS.oneYear,
                label: "1yr Fixed",
              },
              {
                key: "twoYear",
                color: HOUSING_COLORS.twoYear,
                label: "2yr Fixed",
              },
            ]}
            valueFormat="percent"
          />
        </div>
      </div>
    </>
  );
}
