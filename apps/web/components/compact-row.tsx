import { Sparkline } from "./sparkline";

interface CompactRowProps {
  label: string;
  value: string;
  sparklineData: number[];
  change: string;
  changeType: "up" | "down" | "neutral";
}

export function CompactRow({
  label,
  value,
  sparklineData,
  change,
  changeType,
}: CompactRowProps) {
  const changeColor =
    changeType === "up"
      ? "text-[#c44]"
      : changeType === "down"
        ? "text-[#3a8a3a]"
        : "text-[#998]";

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-28 shrink-0 text-sm text-[#555]">{label}</span>
      <span className="w-24 shrink-0 text-right font-mono text-sm font-medium text-[#2a2520]">
        {value}
      </span>
      <div className="flex-1">
        <Sparkline
          data={sparklineData}
          color="#888"
          width={80}
          height={24}
          strokeWidth={1.2}
        />
      </div>
      <span className={`w-16 shrink-0 text-right text-xs font-medium ${changeColor}`}>
        {change}
      </span>
    </div>
  );
}
