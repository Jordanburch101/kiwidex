import type { MetricKey } from "@workspace/db";
import { CompactRow } from "@workspace/ui/components/compact-row";
import { CostOfLivingChart } from "@/components/charts/cost-of-living-chart";
import { getCostOfLivingData, getOverviewData } from "@/lib/queries";

const METRIC_DESCRIPTIONS: Partial<Record<MetricKey | "groceries", string>> = {
  house_price_median:
    "National median house price from REINZ. Published monthly, covering all residential property sales across New Zealand.",
  mortgage_1yr:
    "Average 1-year fixed mortgage rate across major NZ banks. Published weekly by the RBNZ.",
  cpi: "Consumer Price Index — measures the annual change in prices paid for a basket of goods and services. Published quarterly by Stats NZ.",
  unemployment:
    "Percentage of the labour force actively seeking work. Published quarterly by Stats NZ from the Household Labour Force Survey.",
  gdp_growth:
    "Quarterly GDP growth rate. Measures the change in total economic output. Published by Stats NZ.",
  groceries:
    "Average price across a basket of 6 grocery staples (milk, eggs, bread, butter, cheese, bananas). Collected daily from NZ supermarkets.",
  ocr: "The Official Cash Rate set by the RBNZ. The primary tool for controlling inflation — influences mortgage rates, savings rates, and the cost of borrowing.",
  nzd_usd:
    "New Zealand dollar against the US dollar. A weaker Kiwi makes imports more expensive, pushing up consumer prices.",
  median_income:
    "Average annual income derived from Stats NZ Quarterly Employment Survey hourly earnings. Provides context for cost of living relative to what people earn.",
};

// Whether "up" is good or bad for each metric — drives pill colour
const METRIC_SENTIMENT: Partial<
  Record<MetricKey | "groceries", "up_is_good" | "down_is_good">
> = {
  house_price_median: "down_is_good",
  mortgage_1yr: "down_is_good",
  ocr: "down_is_good",
  cpi: "down_is_good",
  unemployment: "down_is_good",
  gdp_growth: "up_is_good",
  groceries: "down_is_good",
  nzd_usd: "up_is_good",
  median_income: "up_is_good",
};

export async function Overview() {
  const [costOfLivingItems, { economyRows }] = await Promise.all([
    getCostOfLivingData(),
    getOverviewData(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.8fr_1fr] lg:items-stretch">
      {/* Left column: Interactive cost of living chart */}
      <CostOfLivingChart items={costOfLivingItems} />

      {/* Right column: Key indicators (housing + economy) */}
      <div className="flex flex-col">
        <h2 className="mb-4 border-[#e5e0d5] border-b pb-2 font-heading font-semibold text-[#2a2520] text-sm">
          Key Indicators
        </h2>
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[#e8e4dc]">
          {economyRows.map((item, i) => (
            <div
              className={`flex flex-1 items-center ${i % 2 === 1 ? "bg-[#faf8f4]" : "bg-white"} ${i < economyRows.length - 1 ? "border-[#f0ece4] border-b" : ""}`}
              key={item.metric}
            >
              <CompactRow
                change={item.change}
                changePeriod={item.changePeriod}
                changeType={item.changeType}
                description={
                  METRIC_DESCRIPTIONS[
                    item.metric as keyof typeof METRIC_DESCRIPTIONS
                  ]
                }
                label={item.label}
                sentiment={
                  METRIC_SENTIMENT[item.metric as keyof typeof METRIC_SENTIMENT]
                }
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
