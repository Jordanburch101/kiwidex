import type { MetricKey } from "@workspace/db";
import { Marquee } from "@workspace/ui/components/marquee";
import { Sparkline } from "@workspace/ui/components/sparkline";
import { formatValue } from "@/lib/data";
import { getTickerData } from "@/lib/queries";

function TickerDot() {
  return (
    <span
      aria-hidden="true"
      className="mx-2 inline-block h-1 w-1 rounded-full bg-[#ccc]"
    />
  );
}

function TickerItem({
  label,
  value,
  sparklineData,
  color = "#888",
}: {
  label: string;
  value: string;
  sparklineData: number[];
  color?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap px-4">
      <span className="text-[#998] text-xs">{label}</span>
      <span className="font-semibold text-[#2a2520] text-sm">{value}</span>
      <Sparkline
        color={color}
        data={sparklineData}
        height={16}
        strokeWidth={1}
        width={48}
      />
    </span>
  );
}

export async function Ticker() {
  const items = await getTickerData();
  const validItems = items.filter(
    (item): item is typeof item & { value: number } => item.value !== null
  );

  if (validItems.length === 0) {
    return null;
  }

  return (
    <Marquee speed={50}>
      {validItems.map((item, i) => (
        <span className="inline-flex items-center" key={item.metric}>
          {i > 0 && <TickerDot />}
          <TickerItem
            color={item.color}
            label={item.label}
            sparklineData={item.sparklineData}
            value={formatValue(item.metric as MetricKey, item.value)}
          />
        </span>
      ))}
    </Marquee>
  );
}
