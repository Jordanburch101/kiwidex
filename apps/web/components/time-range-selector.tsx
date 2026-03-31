"use client";

import type { TimeRange } from "@/lib/filter-by-range";

interface TimeRangeSelectorProps {
  onChange: (range: TimeRange) => void;
  ranges?: TimeRange[];
  value: TimeRange;
}

const ALL_RANGES: { value: TimeRange; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
  { value: "10y", label: "10Y" },
  { value: "all", label: "All" },
];

export function TimeRangeSelector({
  value,
  onChange,
  ranges,
}: TimeRangeSelectorProps) {
  const items = ranges
    ? ALL_RANGES.filter((r) => ranges.includes(r.value))
    : ALL_RANGES;

  return (
    <div className="flex gap-0.5 rounded-md bg-[#f0ece4] p-0.5">
      {items.map((r) => (
        <button
          className={`rounded px-2.5 py-1 font-medium text-xs transition-colors ${
            value === r.value
              ? "bg-white text-[#2a2520] shadow-sm"
              : "text-[#998] hover:text-[#555]"
          }`}
          key={r.value}
          onClick={() => onChange(r.value)}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
