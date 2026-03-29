"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

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

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface AreaChartSectionProps {
  data: TimeSeriesPoint[];
  color: string;
  height?: number;
  valueFormat?: ValueFormat;
}

export function AreaChartSection({
  data,
  color,
  height = 200,
  valueFormat,
}: AreaChartSectionProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[#998]"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const gradientId = `area-fill-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e8e4dc"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#998" }}
          tickLine={false}
          axisLine={{ stroke: "#e8e4dc" }}
          tickFormatter={formatDate}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#998" }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v: number) => formatTick(v, valueFormat)}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface MultiLinePoint {
  date: string;
  [key: string]: string | number;
}

interface MultiLineChartProps {
  data: MultiLinePoint[];
  lines: { key: string; color: string; label: string }[];
  height?: number;
  valueFormat?: ValueFormat;
}

export function MultiLineChart({
  data,
  lines,
  height = 200,
  valueFormat,
}: MultiLineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[#998]"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e8e4dc"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#998" }}
            tickLine={false}
            axisLine={{ stroke: "#e8e4dc" }}
            tickFormatter={formatDate}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#998" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => formatTick(v, valueFormat)}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5 text-xs text-[#998]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            {line.label}
          </div>
        ))}
      </div>
    </div>
  );
}
