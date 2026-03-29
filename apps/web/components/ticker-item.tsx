import { Sparkline } from "./sparkline";

interface TickerItemProps {
  label: string;
  value: string;
  sparklineData: number[];
  color?: string;
}

export function TickerItem({
  label,
  value,
  sparklineData,
  color = "#888",
}: TickerItemProps) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-4">
      <span className="text-xs text-[#998]">{label}</span>
      <span className="text-sm font-semibold text-[#2a2520]">{value}</span>
      <Sparkline
        data={sparklineData}
        color={color}
        width={48}
        height={16}
        strokeWidth={1}
      />
    </span>
  );
}
