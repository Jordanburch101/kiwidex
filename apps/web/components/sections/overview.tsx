import { CompactRow } from "@workspace/ui/components/compact-row";
import { CostOfLivingChart } from "@/components/charts/cost-of-living-chart";
import { getCostOfLivingData, getOverviewData } from "@/lib/queries";

export async function Overview() {
  const [costOfLivingItems, { economyRows }] = await Promise.all([
    getCostOfLivingData(),
    getOverviewData(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr]">
      {/* Left column: Interactive cost of living chart */}
      <CostOfLivingChart items={costOfLivingItems} />

      {/* Right column: Key indicators (housing + economy) */}
      <div>
        <h3 className="mb-4 border-[#e5e0d5] border-b pb-2 font-heading font-semibold text-[#2a2520] text-sm">
          Key Indicators
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
