"use client";

import {
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

interface MultiLinePoint {
  date: string;
  [key: string]: string | number;
}

interface MultiLineChartProps {
  data: MultiLinePoint[];
  height?: number;
  lines: { key: string; color: string; label: string }[];
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
        className="flex items-center justify-center text-[#998] text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer height={height} width="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
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
          {lines.map((line) => (
            <Line
              dataKey={line.key}
              dot={false}
              key={line.key}
              stroke={line.color}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4">
        {lines.map((line) => (
          <div
            className="flex items-center gap-1.5 text-[#998] text-xs"
            key={line.key}
          >
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
