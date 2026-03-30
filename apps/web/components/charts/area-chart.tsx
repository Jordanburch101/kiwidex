"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";

type ValueFormat = "currency" | "percent" | "ratio" | "currency_k";

function formatTick(value: number, format?: ValueFormat): string {
  switch (format) {
    case "currency":
      return `$${value.toFixed(2)}`;
    case "currency_k":
      return `$${(value / 1000).toFixed(0)}k`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(4);
    default:
      return value.toString();
  }
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", {
    month: "short",
    year: "2-digit",
  });
}

function formatDateLong(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface AreaChartSectionProps {
  color: string;
  data: TimeSeriesPoint[];
  height?: number;
  label?: string;
  valueFormat?: ValueFormat;
}

export function AreaChartSection({
  data,
  color,
  height = 200,
  label = "Value",
  valueFormat,
}: AreaChartSectionProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[#998] text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const gradientId = `area-fill-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  const chartConfig: ChartConfig = {
    value: { label, color },
  };

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="#e8e4dc"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          axisLine={{ stroke: "#e8e4dc" }}
          dataKey="date"
          minTickGap={40}
          tick={{ fontSize: 10, fill: "#998" }}
          tickFormatter={formatDate}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fontSize: 10, fill: "#998" }}
          tickFormatter={(v: number) => formatTick(v, valueFormat)}
          tickLine={false}
          width={50}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.date;
                return d ? formatDateLong(d) : "";
              }}
              formatter={(value) => (
                <span className="font-medium font-mono">
                  {formatTick(value as number, valueFormat)}
                </span>
              )}
              hideIndicator
            />
          }
        />
        <Area
          dataKey="value"
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}
