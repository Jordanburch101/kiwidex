"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

type GroupKey = "fuel" | "grocery";

interface CostOfLivingItem {
  key: string;
  label: string;
  unit: string;
  color: string;
  group: GroupKey;
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

const GROCERY_META = {
  combinedKey: "grocery_combined",
  label: "Groceries",
  color: "#5a8a5a",
} as const;

/* Theme tokens — single source for all chart chrome colours */
const T = {
  border: "#e8e4dc",
  bg: "white",
  heading: "#2a2520",
  btnBorder: "#e5e0d5",
  text: "#555",
  muted: "#998",
  dimmed: "#aaa",
} as const;

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

function averageSeries(seriesList: DataPoint[][]): DataPoint[] {
  const byDate = new Map<string, number[]>();
  for (const series of seriesList) {
    for (const pt of series) {
      const arr = byDate.get(pt.date);
      if (arr) {
        arr.push(pt.value);
      } else {
        byDate.set(pt.date, [pt.value]);
      }
    }
  }
  const result: DataPoint[] = [];
  for (const [date, values] of byDate) {
    result.push({
      date,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    });
  }
  result.sort((a, b) => (a.date < b.date ? -1 : 1));
  return result;
}

/**
 * Merge multiple series into Recharts-friendly rows, forward-filling gaps.
 */
function mergeByDate(
  items: { key: string; data: DataPoint[] }[]
): Record<string, string | number>[] {
  const allDates = new Set<string>();
  for (const item of items) {
    for (const pt of item.data) {
      allDates.add(pt.date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  const itemLookups = items.map((item) => {
    const lookup = new Map<string, number>();
    for (const pt of item.data) {
      lookup.set(pt.date, pt.value);
    }
    return { key: item.key, lookup };
  });

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
 * Single source for visible series + chart data.
 * Fuel items are always shown individually. Grocery toggles between combined/split.
 */
function buildChartData(
  groups: Record<GroupKey, CostOfLivingItem[]>,
  normalisedByKey: Map<string, DataPoint[]>,
  groceryCombined: DataPoint[],
  groceryExpanded: boolean
) {
  const series: { key: string; color: string; label: string }[] = [];
  const dataSeries: { key: string; data: DataPoint[] }[] = [];

  // Fuel: always individual
  for (const it of groups.fuel) {
    series.push({ key: it.key, color: it.color, label: it.label });
    dataSeries.push({ key: it.key, data: normalisedByKey.get(it.key) ?? [] });
  }

  // Grocery: combined or split
  if (groceryExpanded) {
    for (const it of groups.grocery) {
      series.push({ key: it.key, color: it.color, label: it.label });
      dataSeries.push({ key: it.key, data: normalisedByKey.get(it.key) ?? [] });
    }
  } else {
    const meta = GROCERY_META;
    series.push({ key: meta.combinedKey, color: meta.color, label: meta.label });
    dataSeries.push({ key: meta.combinedKey, data: groceryCombined });
  }

  return { series, merged: mergeByDate(dataSeries) };
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

type TooltipEntry = {
  dataKey: string | number;
  value: number;
  color: string;
};

function ChartHeader({
  title,
  subtitle,
  range,
  onRangeChange,
  backButton,
}: {
  title: string;
  subtitle: string;
  range: RangeLabel;
  onRangeChange: (r: RangeLabel) => void;
  backButton?: { label: string; onClick: () => void };
}) {
  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-heading font-semibold text-sm" style={{ color: T.heading }}>
            {title}
          </h3>
          {backButton && (
            <button
              className="rounded-md border px-2 py-0.5 text-xs transition-colors"
              style={{ borderColor: T.btnBorder, color: T.text }}
              onClick={backButton.onClick}
              type="button"
            >
              {backButton.label}
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                range === r.label
                  ? "text-white"
                  : "border"
              }`}
              style={
                range === r.label
                  ? { backgroundColor: T.heading }
                  : { borderColor: T.btnBorder, color: T.text }
              }
              key={r.label}
              onClick={() => onRangeChange(r.label)}
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs" style={{ color: T.muted }}>
        {subtitle}
      </p>
    </>
  );
}

function NormalisedTooltip({
  active,
  payload,
  label,
  labelMap,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string;
  labelMap: Map<string, { label: string; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium">
        {label ? formatDateShort(label) : ""}
      </div>
      {sorted.map((entry) => {
        const info = labelMap.get(String(entry.dataKey));
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
              {info?.label ?? entry.dataKey}
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

function SingleTooltip({
  active,
  payload,
  label,
  item,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string;
  item: CostOfLivingItem;
}) {
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
// Legend item
// ---------------------------------------------------------------------------

function LegendDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CostOfLivingChart({ items }: CostOfLivingChartProps) {
  const [range, setRange] = useState<RangeLabel>("90D");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [groceryExpanded, setGroceryExpanded] = useState(false);

  const rangeDays = TIME_RANGES.find((r) => r.label === range)?.days ?? 90;
  const startDate = useMemo(() => getStartDate(rangeDays), [rangeDays]);

  const itemMap = useMemo(
    () => new Map(items.map((it) => [it.key, it])),
    [items]
  );

  const groupedItems = useMemo(() => {
    const groups: Record<GroupKey, CostOfLivingItem[]> = { fuel: [], grocery: [] };
    for (const it of items) {
      groups[it.group].push(it);
    }
    return groups;
  }, [items]);

  const selectedItem = selectedKey ? itemMap.get(selectedKey) ?? null : null;

  const normalisedByKey = useMemo(() => {
    const map = new Map<string, DataPoint[]>();
    for (const it of items) {
      map.set(it.key, normalise(it.data, startDate));
    }
    return map;
  }, [items, startDate]);

  const groceryCombined = useMemo(
    () =>
      averageSeries(
        groupedItems.grocery.map((it) => normalisedByKey.get(it.key) ?? [])
      ),
    [groupedItems, normalisedByKey]
  );

  const { series: visibleSeries, merged: normalisedMerged } = useMemo(
    () => buildChartData(groupedItems, normalisedByKey, groceryCombined, groceryExpanded),
    [groupedItems, normalisedByKey, groceryCombined, groceryExpanded]
  );

  // Only register visible series in chart config — Recharts uses config keys
  // to determine domain, so stale keys from individual groceries would
  // pollute the Y-axis range in the collapsed view.
  const chartConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const s of visibleSeries) {
      cfg[s.key] = { label: s.label, color: s.color };
    }
    return cfg;
  }, [visibleSeries]);

  // Explicit Y domain from visible data only
  const yDomain = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const row of normalisedMerged) {
      for (const s of visibleSeries) {
        const v = row[s.key];
        if (typeof v === "number") {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return [Math.floor(min / 10) * 10, Math.ceil(max / 10) * 10] as const;
  }, [normalisedMerged, visibleSeries]);

  const tooltipLabelMap = useMemo(
    () => new Map(visibleSeries.map((s) => [s.key, { label: s.label, color: s.color }])),
    [visibleSeries]
  );

  const singleData = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.data.filter((d) => d.date >= startDate);
  }, [selectedItem, startDate]);

  const handleLegendClick = useCallback((key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  const toggleGrocery = useCallback(() => {
    setGroceryExpanded((prev) => !prev);
  }, []);

  // ---------------------------------------------------------------------------
  // Render: Single item detail view
  // ---------------------------------------------------------------------------
  if (selectedItem && singleData.length > 0) {
    const gradientId = `area-single-${selectedItem.key}`;
    const singleConfig: ChartConfig = {
      [selectedItem.key]: { label: selectedItem.label, color: selectedItem.color },
    };
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: T.border, backgroundColor: T.bg }}>
        <ChartHeader
          title={selectedItem.label}
          subtitle={selectedItem.unit === "nzd_per_litre" ? "Price per litre" : "Price"}
          range={range}
          onRangeChange={setRange}
          backButton={{ label: "\u2190 All", onClick: () => setSelectedKey(null) }}
        />
        <ChartContainer config={singleConfig} className="aspect-[2.2/1] w-full">
          <AreaChart data={singleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={selectedItem.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={selectedItem.color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={{ stroke: T.border }}
              dataKey="date"
              minTickGap={40}
              tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={formatDateAxis}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fontSize: 10, fill: T.muted }}
              tickFormatter={(v: number) => formatUnit(v, selectedItem.unit)}
              tickLine={false}
              width={55}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(props) => (
                <SingleTooltip
                  active={props.active}
                  payload={props.payload as ReadonlyArray<TooltipEntry>}
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
    <div className="rounded-lg border p-4" style={{ borderColor: T.border, backgroundColor: T.bg }}>
      <ChartHeader
        title="At the Pump &amp; Shelf"
        subtitle="Showing % change from start of period"
        range={range}
        onRangeChange={setRange}
      />

      <ChartContainer config={chartConfig} className="aspect-[2.2/1] w-full [&_.recharts-area-area]:transition-all [&_.recharts-area-area]:duration-300 [&_.recharts-area-area]:ease-out [&_.recharts-area-curve]:transition-all [&_.recharts-area-curve]:duration-300 [&_.recharts-area-curve]:ease-out">
        <ComposedChart data={normalisedMerged} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            {visibleSeries.map((s) => (
              <linearGradient key={s.key} id={`area-norm-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={{ stroke: T.border }}
            dataKey="date"
            minTickGap={40}
            tick={{ fontSize: 10, fill: T.muted }}
            tickFormatter={formatDateAxis}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 10, fill: T.muted }}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
            tickLine={false}
            width={45}
            domain={yDomain}
          />
          <Tooltip
            content={(props) => (
              <NormalisedTooltip
                active={props.active}
                payload={props.payload as ReadonlyArray<TooltipEntry>}
                label={props.label as string}
                labelMap={tooltipLabelMap}
              />
            )}
          />

          {visibleSeries.map((s) => {
            const isHovered = hoveredKey === s.key;
            const isFaded = hoveredKey !== null && !isHovered;
            return (
              <Area
                key={s.key}
                dataKey={s.key}
                fill={`url(#area-norm-${s.key})`}
                stroke={s.color}
                strokeWidth={isHovered ? 3 : 1.5}
                strokeOpacity={isFaded ? 0.15 : 1}
                fillOpacity={isHovered ? 1 : 0}
                type="monotone"
                animationDuration={500}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            );
          })}
        </ComposedChart>
      </ChartContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {/* Fuel — always individual */}
        {groupedItems.fuel.map((it) => (
          <button
            key={it.key}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors"
            onClick={() => handleLegendClick(it.key)}
            onMouseEnter={() => setHoveredKey(it.key)}
            onMouseLeave={() => setHoveredKey(null)}
            type="button"
          >
            <LegendDot color={it.color} />
            <span style={{ color: T.text }}>{it.label}</span>
          </button>
        ))}

        {/* Grocery — combined or individual */}
        <button
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors ${
            groceryExpanded ? "border" : ""
          }`}
          style={groceryExpanded ? { borderColor: T.btnBorder } : undefined}
          onClick={toggleGrocery}
          onMouseEnter={() => { if (!groceryExpanded) setHoveredKey(GROCERY_META.combinedKey); }}
          onMouseLeave={() => setHoveredKey(null)}
          type="button"
        >
          <LegendDot color={GROCERY_META.color} />
          <span style={{ color: T.text }}>{GROCERY_META.label}</span>
          <span style={{ color: T.dimmed }}>{groceryExpanded ? "−" : "+"}</span>
        </button>

        {groceryExpanded && groupedItems.grocery.map((it) => (
          <button
            key={it.key}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors"
            onClick={() => handleLegendClick(it.key)}
            onMouseEnter={() => setHoveredKey(it.key)}
            onMouseLeave={() => setHoveredKey(null)}
            type="button"
          >
            <LegendDot color={it.color} />
            <span style={{ color: T.text }}>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
