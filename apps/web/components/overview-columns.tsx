import type { MetricKey } from "@workspace/db";
import { formatValue } from "@/lib/data";
import { CompactRow } from "./compact-row";
import { MetricCard } from "./metric-card";

interface MetricCardData {
  metric: MetricKey;
  label: string;
  value: number | null;
  change: string;
  changeType: "up" | "down" | "neutral";
  sparklineData: number[];
  color: string;
  dateRange: { from: string; to: string };
}

interface CompactRowData {
  metric: MetricKey;
  label: string;
  value: number | null;
  change: string;
  changeType: "up" | "down" | "neutral";
  sparklineData: number[];
}

interface OverviewColumnsProps {
  fuelGroceries: MetricCardData[];
  housingRates: MetricCardData[];
  economyRows: CompactRowData[];
}

export function OverviewColumns({
  fuelGroceries,
  housingRates,
  economyRows,
}: OverviewColumnsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr_0.7fr]">
      {/* Left column: At the Pump & Shelf */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#998]">
          At the Pump & Shelf
        </h3>
        <div className="space-y-4">
          {fuelGroceries.map((item) => (
            <MetricCard
              key={item.metric}
              label={item.label}
              value={item.value !== null ? formatValue(item.metric, item.value) : "\u2014"}
              change={item.change}
              changeType={item.changeType}
              sparklineData={item.sparklineData}
              color={item.color}
              dateRange={item.dateRange}
            />
          ))}
        </div>
      </div>

      {/* Middle column: Housing & Rates */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#998]">
          Housing & Rates
        </h3>
        <div className="space-y-4">
          {housingRates.map((item) => (
            <MetricCard
              key={item.metric}
              label={item.label}
              value={item.value !== null ? formatValue(item.metric, item.value) : "\u2014"}
              change={item.change}
              changeType={item.changeType}
              sparklineData={item.sparklineData}
              color={item.color}
              dateRange={item.dateRange}
            />
          ))}
        </div>
      </div>

      {/* Right column: The Economy */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#998]">
          The Economy
        </h3>
        <div className="rounded-lg border border-[#e8e4dc] bg-white p-4">
          {economyRows.map((item, i) => (
            <div key={item.metric}>
              {i > 0 && <div className="border-t border-[#e8e4dc]" />}
              <CompactRow
                label={item.label}
                value={item.value !== null ? formatValue(item.metric, item.value) : "\u2014"}
                sparklineData={item.sparklineData}
                change={item.change}
                changeType={item.changeType}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
