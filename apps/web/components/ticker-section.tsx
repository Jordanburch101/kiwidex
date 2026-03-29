import type { MetricKey } from "@workspace/db";
import { formatValue } from "@/lib/data";
import { Marquee } from "./marquee";
import { TickerItem } from "./ticker-item";

interface TickerDataItem {
  metric: MetricKey;
  label: string;
  value: number | null;
  sparklineData: number[];
  color?: string;
}

interface TickerSectionProps {
  items: TickerDataItem[];
}

function TickerDot() {
  return (
    <span className="inline-block h-1 w-1 rounded-full bg-[#ccc] mx-2" aria-hidden="true" />
  );
}

export function TickerSection({ items }: TickerSectionProps) {
  const validItems = items.filter((item) => item.value !== null);

  if (validItems.length === 0) {
    return null;
  }

  return (
    <Marquee speed={50}>
      {validItems.map((item, i) => (
        <span key={item.metric} className="inline-flex items-center">
          {i > 0 && <TickerDot />}
          <TickerItem
            label={item.label}
            value={formatValue(item.metric, item.value!)}
            sparklineData={item.sparklineData}
            color={item.color}
          />
        </span>
      ))}
    </Marquee>
  );
}
