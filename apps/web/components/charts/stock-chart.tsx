"use client";

import {
  type AreaData,
  AreaSeries,
  type BusinessDay,
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

function toBusinessDay(dateStr: string): BusinessDay {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

/**
 * Resolve a CSS color (including var() and oklch/lab) to a hex string
 * that Lightweight Charts can parse.
 */
function resolveColor(raw: string, el: Element): string {
  let color = raw;
  if (color.startsWith("var(")) {
    const name = color.slice(4, -1).trim();
    color = getComputedStyle(el).getPropertyValue(name).trim() || raw;
  }
  // Lightweight Charts only understands hex/rgb — convert via canvas
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return color;
  }
  ctx.fillStyle = color;
  return ctx.fillStyle; // always returns #rrggbb or rgba()
}

interface CandlestickChartProps {
  data: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  downColor?: string;
  height?: number;
  upColor?: string;
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
    if (!container || data.length === 0) {
      return;
    }

    const r = (v: string) => resolveColor(v, container);

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: r("var(--foreground)"),
        fontSize: 11,
      },
      grid: {
        vertLines: { color: r("var(--border)") },
        horzLines: { color: r("var(--border)") },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: r("var(--card)") },
        horzLine: { labelBackgroundColor: r("var(--card)") },
      },
      rightPriceScale: {
        borderColor: r("var(--border)"),
      },
      timeScale: {
        borderColor: r("var(--border)"),
        timeVisible: false,
      },
    });

    const resolvedUp = r(upColor);
    const resolvedDown = r(downColor);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: resolvedUp,
      downColor: resolvedDown,
      borderUpColor: resolvedUp,
      borderDownColor: resolvedDown,
      wickUpColor: resolvedUp,
      wickDownColor: resolvedDown,
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
  color?: string;
  data: { date: string; value: number }[];
  height?: number;
}

export function SparklineArea({
  data,
  height = 60,
  color = "var(--chart-1)",
}: SparklineAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) {
      return;
    }

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

    const resolved = resolveColor(color, container);
    const series = chart.addSeries(AreaSeries, {
      lineColor: resolved,
      topColor: `${resolved}33`,
      bottomColor: `${resolved}05`,
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
