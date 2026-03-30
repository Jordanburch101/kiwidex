import { Sparkline } from "@workspace/ui/components/sparkline";

const INDICATOR = {
  up: "#2ea85a",
  down: "#e24b35",
  neutral: "#888888",
  upBg: "#f0fdf4",
  downBg: "#fef2f2",
  neutralBg: "#f4f2ed",
} as const;

interface MetricCardProps {
  change: string;
  changeType: "up" | "down" | "neutral";
  color: string;
  dateRange: { from: string; to: string };
  label: string;
  sparklineData: number[];
  value: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeType,
  sparklineData,
  color,
  dateRange,
}: MetricCardProps) {
  let trendFg = INDICATOR.neutral;
  let trendBg = INDICATOR.neutralBg;
  if (changeType === "up") {
    trendFg = INDICATOR.down;
    trendBg = INDICATOR.downBg;
  } else if (changeType === "down") {
    trendFg = INDICATOR.up;
    trendBg = INDICATOR.upBg;
  }

  return (
    <div className="rounded-lg border border-[#e8e4dc] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[#998] text-xs uppercase tracking-wider">
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-medium text-xs"
          style={{ backgroundColor: trendBg, color: trendFg }}
        >
          {change}
        </span>
      </div>
      <div className="mt-2 font-heading font-semibold text-3xl text-[#2a2520]">
        {value}
      </div>
      <div className="mt-3">
        <Sparkline
          color={color}
          data={sparklineData}
          fill
          height={64}
          strokeWidth={2}
          width={280}
        />
      </div>
      <div className="mt-2 flex justify-between text-[#998] text-[10px]">
        <span>{dateRange.from}</span>
        <span>{dateRange.to}</span>
      </div>
    </div>
  );
}
