import type { MetricKey } from "@workspace/db";
import { Marquee } from "@workspace/ui/components/marquee";
import { formatValue } from "@/lib/data";
import { getTickerData } from "@/lib/queries";
import { TickerItem } from "./ticker-item";

function TickerDot() {
  return (
    <span
      aria-hidden="true"
      className="mx-2 inline-block h-1 w-1 rounded-full bg-[#ccc]"
    />
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
