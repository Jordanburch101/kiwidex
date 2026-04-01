"use client";

import { useState } from "react";
import { CandlestickChart, SparklineArea } from "@/components/charts/stock-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { STOCK_COLORS } from "@/lib/colors";
import { filterByRange, type TimeRange } from "@/lib/filter-by-range";

interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface QuoteInfo {
  ticker: string;
  close: number;
  date: string;
}

const BELLWETHER_META: Record<string, { label: string; color: string }> = {
  "AIR.NZ": { label: "Air NZ", color: STOCK_COLORS.air_nz },
  "FPH.NZ": { label: "Fisher & Paykel", color: STOCK_COLORS.fph },
  "MEL.NZ": { label: "Meridian", color: STOCK_COLORS.mel },
  "FBU.NZ": { label: "Fletcher Building", color: STOCK_COLORS.fbu },
};

interface MarketsChartsProps {
  nzx50: OhlcPoint[];
  bellwethers: Record<string, { date: string; value: number }[]>;
  quotes: QuoteInfo[];
}

export function MarketsCharts({ nzx50, bellwethers, quotes }: MarketsChartsProps) {
  const [range, setRange] = useState<TimeRange>("1y");

  const filteredNzx50 = filterByRange(nzx50, range);

  return (
    <>
      <div className="mb-6 flex justify-end">
        <TimeRangeSelector
          onChange={setRange}
          ranges={["90d", "1y", "5y", "all"]}
          value={range}
        />
      </div>

      <CandlestickChart data={filteredNzx50} height={300} />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Object.entries(BELLWETHER_META).map(([ticker, { label, color }]) => {
          const seriesData = bellwethers[ticker] ?? [];
          const filteredData = filterByRange(seriesData, range);
          const quote = quotes.find((q) => q.ticker === ticker);
          const prevClose =
            filteredData.length >= 2
              ? filteredData[filteredData.length - 2]?.value
              : null;
          const change =
            quote && prevClose
              ? ((quote.close - prevClose) / prevClose) * 100
              : null;

          return (
            <div
              className="rounded-lg border border-[#e5e0d5] bg-white p-3"
              key={ticker}
            >
              <p className="font-medium text-[#2a2520] text-xs">{label}</p>
              <p className="mt-0.5 font-mono text-lg text-[#2a2520]">
                ${quote?.close.toFixed(2) ?? "—"}
              </p>
              {change !== null && (
                <p
                  className={`mt-0.5 font-mono text-xs ${
                    change >= 0 ? "text-[#2ea85a]" : "text-[#e24b35]"
                  }`}
                >
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                </p>
              )}
              <div className="mt-2">
                <SparklineArea color={color} data={filteredData} height={50} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
