"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card";
import { Sparkline } from "@workspace/ui/components/sparkline";

interface CompactRowProps {
  change: string;
  changeType: "up" | "down" | "neutral";
  description?: string;
  label: string;
  sentiment?: "up_is_good" | "down_is_good";
  sparklineData: number[];
  value: string;
}

function getPillClass(
  changeType: "up" | "down" | "neutral",
  sentiment?: "up_is_good" | "down_is_good"
): string {
  if (changeType === "neutral") {
    return "bg-[#f4f2ed] text-[#998]";
  }

  // Determine if this direction is good or bad
  const isGood =
    sentiment === "up_is_good"
      ? changeType === "up"
      : sentiment === "down_is_good"
        ? changeType === "down"
        : false;

  // No sentiment defined — fall back to neutral styling
  if (!sentiment) {
    return changeType === "up"
      ? "bg-[#fef2f2] text-[#c44]"
      : "bg-[#f0fdf4] text-[#3a8a3a]";
  }

  return isGood
    ? "bg-[#f0fdf4] text-[#3a8a3a]"
    : "bg-[#fef2f2] text-[#c44]";
}

export function CompactRow({
  label,
  value,
  change,
  changeType,
  description,
  sentiment,
  sparklineData,
}: CompactRowProps) {
  const pillClass = getPillClass(changeType, sentiment);

  return (
    <HoverCard>
      <HoverCardTrigger className="flex w-full cursor-default items-center gap-3 px-3.5 py-2.5">
        <span className="flex-1 text-[#776] text-xs">{label}</span>
        <span className="font-mono font-semibold text-[#2a2520] text-sm">
          {value}
        </span>
        <span
          className={`min-w-[56px] rounded-full px-2 py-0.5 text-center font-medium text-[10px] ${pillClass}`}
        >
          {change}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-64 border-[#e8e4dc] bg-white p-4"
        side="left"
        sideOffset={8}
      >
        <div className="mb-1 font-semibold text-[#2a2520] text-xs uppercase tracking-wider">
          {label}
        </div>
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-bold font-mono text-[#2a2520] text-lg">
            {value}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-medium text-[10px] ${pillClass}`}
          >
            {change}
          </span>
        </div>
        {description && (
          <p className="mb-3 text-[#887] text-[11px] leading-relaxed">
            {description}
          </p>
        )}
        {sparklineData.length >= 2 && (
          <div className="rounded-md bg-[#f4f2ed] p-2.5">
            <div className="mb-1 text-[#998] text-[8px] uppercase tracking-wider">
              Last 12 months
            </div>
            <Sparkline
              color="#998"
              data={sparklineData}
              fill
              height={36}
              strokeWidth={1.5}
              width={200}
            />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
