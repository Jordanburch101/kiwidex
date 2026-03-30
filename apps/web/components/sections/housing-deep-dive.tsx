import { SectionHeader } from "@workspace/ui/components/section-header";
import { HousingCharts } from "@/components/sections/housing-charts";
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
      <HousingCharts housePrice={housePrice} mortgageData={mortgageData} />
    </section>
  );
}
