import { Sparkline } from "./sparkline";

interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  sparklineData: number[];
  color: string;
  dateRange: { from: string; to: string };
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
  const trendColor =
    changeType === "up"
      ? "bg-[#c44]/10 text-[#c44]"
      : changeType === "down"
        ? "bg-[#3a8a3a]/10 text-[#3a8a3a]"
        : "bg-[#998]/10 text-[#998]";

  return (
    <div className="rounded-lg border border-[#e8e4dc] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[#998]">
          {label}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${trendColor}`}
        >
          {change}
        </span>
      </div>
      <div className="mt-2 font-heading text-3xl font-semibold text-[#2a2520]">
        {value}
      </div>
      <div className="mt-3">
        <Sparkline
          data={sparklineData}
          color={color}
          width={280}
          height={48}
          fill
          strokeWidth={2}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[#998]">
        <span>{dateRange.from}</span>
        <span>{dateRange.to}</span>
      </div>
    </div>
  );
}
