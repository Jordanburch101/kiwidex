import { CompactRow } from "@workspace/ui/components/compact-row";
import { MetricCard } from "@workspace/ui/components/metric-card";
import { getOverviewData } from "@/lib/queries";

export async function Overview() {
  const { fuelGroceries, housingRates, economyRows } = await getOverviewData();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr_0.7fr]">
      {/* Left column: At the Pump & Shelf */}
      <div>
        <h3 className="mb-4 border-[#e5e0d5] border-b pb-2 font-heading font-semibold text-[#2a2520] text-sm">
          At the Pump & Shelf
        </h3>
        <div className="space-y-4">
          {fuelGroceries.map((item) => (
            <MetricCard
              change={item.change}
              changeType={item.changeType}
              color={item.color}
              dateRange={item.dateRange}
              key={item.metric}
              label={item.label}
              sparklineData={item.sparklineData}
              value={item.value}
            />
          ))}
        </div>
      </div>

      {/* Middle column: Housing & Rates */}
      <div>
        <h3 className="mb-4 border-[#e5e0d5] border-b pb-2 font-heading font-semibold text-[#2a2520] text-sm">
          Housing & Rates
        </h3>
        <div className="space-y-4">
          {housingRates.map((item) => (
            <MetricCard
              change={item.change}
              changeType={item.changeType}
              color={item.color}
              dateRange={item.dateRange}
              key={item.metric}
              label={item.label}
              sparklineData={item.sparklineData}
              value={item.value}
            />
          ))}
        </div>
      </div>

      {/* Right column: The Economy */}
      <div>
        <h3 className="mb-4 border-[#e5e0d5] border-b pb-2 font-heading font-semibold text-[#2a2520] text-sm">
          The Economy
        </h3>
        <div className="rounded-lg border border-[#e8e4dc] bg-white p-4">
          {economyRows.map((item, i) => (
            <div key={item.metric}>
              {i > 0 && <div className="border-[#e8e4dc] border-t" />}
              <CompactRow
                change={item.change}
                changeType={item.changeType}
                label={item.label}
                sparklineData={item.sparklineData}
                value={item.value}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
