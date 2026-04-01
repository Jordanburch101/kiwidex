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
import { DATA, INDICATOR } from "@/lib/colors";

function toBusinessDay(dateStr: string): BusinessDay {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

// Theme colors as hex — Lightweight Charts cannot parse oklch/lab/var()
const CHART_THEME = {
  text: "#3d3830",
  border: "#e5e0d5",
  background: "transparent",
  card: "#ffffff",
} as const;

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
  upColor = INDICATOR.up,
  downColor = INDICATOR.down,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) {
      return;
    }

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: CHART_THEME.border },
        horzLines: { color: CHART_THEME.border },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: CHART_THEME.card },
        horzLine: { labelBackgroundColor: CHART_THEME.card },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.border,
      },
      timeScale: {
        borderColor: CHART_THEME.border,
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

  return <div className="[&_a[href*='tradingview']]:!hidden" ref={containerRef} />;
}

interface SparklineAreaProps {
  color?: string;
  data: { date: string; value: number }[];
  height?: number;
}

export function SparklineArea({
  data,
  height = 60,
  color = DATA.blue,
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
