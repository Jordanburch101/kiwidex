"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type AreaData,
  type BusinessDay,
  ColorType,
  CandlestickSeries,
  AreaSeries,
} from "lightweight-charts";

function toBusinessDay(dateStr: string): BusinessDay {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

interface CandlestickChartProps {
  data: { date: string; open: number; high: number; low: number; close: number }[];
  height?: number;
  upColor?: string;
  downColor?: string;
}

export function CandlestickChart({
  data,
  height = 300,
  upColor = "var(--chart-1)",
  downColor = "var(--destructive)",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "var(--foreground)",
        fontFamily: "var(--font-geist-mono)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "var(--border)" },
        horzLines: { color: "var(--border)" },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "var(--card)" },
        horzLine: { labelBackgroundColor: "var(--card)" },
      },
      rightPriceScale: {
        borderColor: "var(--border)",
      },
      timeScale: {
        borderColor: "var(--border)",
        timeVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });

    const candlestickData: CandlestickData[] = data.map((d) => ({
      time: toBusinessDay(d.date),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    series.setData(candlestickData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height, upColor, downColor]);

  return <div ref={containerRef} />;
}

interface SparklineAreaProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
}

export function SparklineArea({
  data,
  height = 60,
  color = "var(--chart-1)",
}: SparklineAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}33`,
      bottomColor: `${color}05`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const areaData: AreaData[] = data.map((d) => ({
      time: toBusinessDay(d.date),
      value: d.value,
    }));

    series.setData(areaData);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [data, height, color]);

  return <div ref={containerRef} />;
}
