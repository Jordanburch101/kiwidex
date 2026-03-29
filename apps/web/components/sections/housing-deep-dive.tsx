import { SectionHeader } from "@workspace/ui/components/section-header";
import { AreaChartSection } from "@/components/charts/area-chart";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { getHousingChartData } from "@/lib/queries";

export async function HousingDeepDive() {
  const { housePrice, mortgageFloating, mortgage1yr, mortgage2yr } =
    await getHousingChartData();

  // Merge mortgage rates into multi-line format
  const dateMap = new Map<
    string,
    { date: string; floating?: number; oneYear?: number; twoYear?: number }
  >();

  for (const p of mortgageFloating) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.floating = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of mortgage1yr) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.oneYear = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of mortgage2yr) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.twoYear = p.value;
    dateMap.set(p.date, entry);
  }

  const mortgageData = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Median house price and mortgage rate trends"
        title="Housing & Mortgages"
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Median House Price
          </h4>
          <AreaChartSection
            color="oklch(0.508 0.118 165.612)"
            data={housePrice}
            height={200}
            valueFormat="currency_k"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Mortgage Rates
          </h4>
          <MultiLineChart
            data={mortgageData}
            height={200}
            lines={[
              { key: "floating", color: "#c44", label: "Floating" },
              { key: "oneYear", color: "#e68a00", label: "1yr Fixed" },
              { key: "twoYear", color: "#3a8a3a", label: "2yr Fixed" },
            ]}
            valueFormat="percent"
          />
        </div>
      </div>
    </section>
  );
}
