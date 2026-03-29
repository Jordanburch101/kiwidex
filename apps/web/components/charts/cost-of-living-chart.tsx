"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@workspace/ui/components/chart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataPoint {
  date: string;
  value: number;
}

interface CostOfLivingItem {
  key: string;
  label: string;
  unit: string;
  color: string;
  data: DataPoint[];
}

export interface CostOfLivingChartProps {
  items: CostOfLivingItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

type RangeLabel = (typeof TIME_RANGES)[number]["label"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function formatDateAxis(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" });
}

function formatUnit(value: number, unit: string): string {
  switch (unit) {
    case "nzd_per_litre":
      return `$${value.toFixed(2)}/L`;
    case "nzd":
      if (value >= 10_000) return `$${Math.round(value / 1000)}K`;
      return `$${value.toFixed(2)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    default:
      return value.toFixed(2);
  }
}

function getStartDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

function normalise(data: DataPoint[], startDate: string): DataPoint[] {
  const filtered = data.filter((d) => d.date >= startDate);
  const baseline = filtered[0]?.value;
  if (!baseline) return [];
  return filtered.map((d) => ({
    date: d.date,
    value: ((d.value - baseline) / baseline) * 100,
  }));
}

/**
 * Merge multiple item series into a single array of objects keyed by date,
 * suitable for Recharts ComposedChart.
 *
 * Items have different data frequencies (petrol = weekly, groceries = monthly).
 * We forward-fill missing values so every date row has a value for every item.
 */
function mergeByDate(
  items: { key: string; data: DataPoint[] }[]
): Record<string, string | number>[] {
  // Collect all unique dates across all items
  const allDates = new Set<string>();
  for (const item of items) {
    for (const pt of item.data) {
      allDates.add(pt.date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  // For each item, build a lookup and prepare forward-fill
  const itemLookups = items.map((item) => {
    const lookup = new Map<string, number>();
    for (const pt of item.data) {
      lookup.set(pt.date, pt.value);
    }
    return { key: item.key, lookup };
  });

  // Build merged rows with forward-fill
  const result: Record<string, string | number>[] = [];
  const lastKnown: Record<string, number | undefined> = {};

  for (const date of sortedDates) {
    const row: Record<string, string | number> = { date };
    for (const { key, lookup } of itemLookups) {
      const val = lookup.get(date);
      if (val !== undefined) {
        lastKnown[key] = val;
        row[key] = val;
      } else if (lastKnown[key] !== undefined) {
        row[key] = lastKnown[key]!;
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * Determine which item has the biggest absolute max swing (most volatile).
 */
function getMostVolatileKey(
  items: { key: string; data: DataPoint[] }[]
): string | null {
  let maxSwing = 0;
  let result: string | null = null;
  for (const item of items) {
    if (item.data.length === 0) continue;
    const vals = item.data.map((d) => d.value);
    const swing = Math.max(...vals.map(Math.abs));
    if (swing > maxSwing) {
      maxSwing = swing;
      result = item.key;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

type TooltipEntry = {
  dataKey: string | number;
  value: number;
  color: string;
};

interface NormalisedTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string;
  itemMap: Map<string, CostOfLivingItem>;
}

function NormalisedTooltip({
  active,
  payload,
  label,
  itemMap,
}: NormalisedTooltipProps) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium">
        {label ? formatDateShort(label) : ""}
      </div>
      {sorted.map((entry) => {
        const item = itemMap.get(String(entry.dataKey));
        const sign = entry.value >= 0 ? "+" : "";
        return (
          <div
            key={String(entry.dataKey)}
            className="flex items-center gap-2 py-0.5"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {item?.label ?? entry.dataKey}
            </span>
            <span className="ml-auto font-medium font-mono tabular-nums">
              {sign}
              {entry.value.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface SingleTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string;
  item: CostOfLivingItem;
}

function SingleTooltip({ active, payload, label, item }: SingleTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium">
        {label ? formatDateShort(label) : ""}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{item.label}:</span>
        <span className="font-medium font-mono tabular-nums">
          {formatUnit(entry.value, item.unit)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CostOfLivingChart({ items }: CostOfLivingChartProps) {
  const [range, setRange] = useState<RangeLabel>("90D");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const rangeDays = TIME_RANGES.find((r) => r.label === range)?.days ?? 90;
  const startDate = useMemo(() => getStartDate(rangeDays), [rangeDays]);

  const itemMap = useMemo(
    () => new Map(items.map((it) => [it.key, it])),
    [items]
  );

  const selectedItem = selectedKey ? itemMap.get(selectedKey) ?? null : null;

  // --- Normalised multi-line data ---
  const normalisedItems = useMemo(
    () =>
      items.map((it) => ({
        key: it.key,
        data: normalise(it.data, startDate),
      })),
    [items, startDate]
  );
  const normalisedMerged = useMemo(
    () => mergeByDate(normalisedItems),
    [normalisedItems]
  );
  const mostVolatileKey = useMemo(
    () => getMostVolatileKey(normalisedItems),
    [normalisedItems]
  );

  // --- Single item data ---
  const singleData = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.data.filter((d) => d.date >= startDate);
  }, [selectedItem, startDate]);

  // --- Chart config for shadcn ---
  const chartConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const it of items) {
      cfg[it.key] = { label: it.label, color: it.color };
    }
    return cfg;
  }, [items]);

  const handleLegendClick = useCallback(
    (key: string) => {
      setSelectedKey((prev) => (prev === key ? null : key));
    },
    []
  );

  const handleShowAll = useCallback(() => {
    setSelectedKey(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render: Single item view
  // ---------------------------------------------------------------------------
  if (selectedItem && singleData.length > 0) {
    const gradientId = `area-single-${selectedItem.key}`;
    return (
      <div className="rounded-lg border border-[#e8e4dc] bg-white p-4">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-heading font-semibold text-[#2a2520] text-sm">
              {selectedItem.label}
            </h3>
            <button
              className="rounded-md border border-[#e5e0d5] px-2 py-0.5 text-[#555] text-xs transition-colors hover:bg-[#f5f0e8]"
              onClick={handleShowAll}
              type="button"
            >
              &larr; All
            </button>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  range === r.label
                    ? "bg-[#2a2520] text-white"
                    : "border border-[#e5e0d5] text-[#555] hover:bg-[#f5f0e8]"
                }`}
                key={r.label}
                onClick={() => setRange(r.label)}
                type="button"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-[#998] text-xs">
          {selectedItem.unit === "nzd_per_litre"
            ? "Price per litre"
            : "Price"}
        </p>

        <ChartContainer config={chartConfig} className="aspect-[2.2/1] w-full">
          <AreaChart
            data={singleData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={selectedItem.color}
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor={selectedItem.color}
                  stopOpacity={0.03}
                />
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
              tickFormatter={formatDateAxis}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fontSize: 10, fill: "#998" }}
              tickFormatter={(v: number) => formatUnit(v, selectedItem.unit)}
              tickLine={false}
              width={55}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(props) => (
                <SingleTooltip
                  active={props.active}
                  payload={
                    props.payload as SingleTooltipProps["payload"]
                  }
                  label={props.label as string}
                  item={selectedItem}
                />
              )}
            />
            <Area
              dataKey="value"
              fill={`url(#${gradientId})`}
              stroke={selectedItem.color}
              strokeWidth={2}
              type="monotone"
              animationDuration={500}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Normalised multi-line view
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-lg border border-[#e8e4dc] bg-white p-4">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-heading font-semibold text-[#2a2520] text-sm">
          At the Pump &amp; Shelf
        </h3>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                range === r.label
                  ? "bg-[#2a2520] text-white"
                  : "border border-[#e5e0d5] text-[#555] hover:bg-[#f5f0e8]"
              }`}
              key={r.label}
              onClick={() => setRange(r.label)}
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-[#998] text-xs">
        Showing % change from start of period
      </p>

      <ChartContainer config={chartConfig} className="aspect-[2.2/1] w-full">
        <ComposedChart
          data={normalisedMerged}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            {items.map((it) => (
              <linearGradient
                key={it.key}
                id={`area-norm-${it.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={it.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={it.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
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
            tickFormatter={formatDateAxis}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 10, fill: "#998" }}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
            tickLine={false}
            width={45}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={(props) => (
              <NormalisedTooltip
                active={props.active}
                payload={
                  props.payload as NormalisedTooltipProps["payload"]
                }
                label={props.label as string}
                itemMap={itemMap}
              />
            )}
          />

          {items.map((it) => {
            const isVolatile = it.key === mostVolatileKey;
            if (isVolatile) {
              return (
                <Area
                  key={it.key}
                  dataKey={it.key}
                  fill={`url(#area-norm-${it.key})`}
                  stroke={it.color}
                  strokeWidth={2}
                  type="monotone"
                  animationDuration={500}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              );
            }
            return (
              <Line
                key={it.key}
                dataKey={it.key}
                stroke={it.color}
                strokeWidth={1.5}
                type="monotone"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                animationDuration={500}
              />
            );
          })}
        </ComposedChart>
      </ChartContainer>

      {/* Clickable Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <button
            key={it.key}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-[#f5f0e8]"
            onClick={() => handleLegendClick(it.key)}
            type="button"
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: it.color }}
            />
            <span className="text-[#555]">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
