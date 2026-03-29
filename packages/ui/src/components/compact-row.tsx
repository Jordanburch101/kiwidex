import { Sparkline } from "@workspace/ui/components/sparkline";

interface CompactRowProps {
  change: string;
  changeType: "up" | "down" | "neutral";
  label: string;
  sparklineData: number[];
  value: string;
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
      <span className="w-28 shrink-0 text-[#555] text-sm">{label}</span>
      <span className="w-24 shrink-0 text-right font-medium font-mono text-[#2a2520] text-sm">
        {value}
      </span>
      <div className="flex-1">
        <Sparkline
          color="#888"
          data={sparklineData}
          height={24}
          strokeWidth={1.2}
          width={80}
        />
      </div>
      <span
        className={`w-16 shrink-0 text-right font-medium text-xs ${changeColor}`}
      >
        {change}
      </span>
    </div>
  );
}
