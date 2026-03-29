import { SectionHeader } from "./section-header";
import { AreaChartSection, MultiLineChart } from "./deep-dive-chart";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface HousingSectionProps {
  housePrice: TimeSeriesPoint[];
  mortgageFloating: TimeSeriesPoint[];
  mortgage1yr: TimeSeriesPoint[];
  mortgage2yr: TimeSeriesPoint[];
}

export function HousingSection({
  housePrice,
  mortgageFloating,
  mortgage1yr,
  mortgage2yr,
}: HousingSectionProps) {
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
    <section className="py-10">
      <SectionHeader
        title="Housing & Mortgages"
        subtitle="Median house price and mortgage rate trends"
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#555]">
            Median House Price
          </h4>
          <AreaChartSection
            data={housePrice}
            color="oklch(0.508 0.118 165.612)"
            height={200}
            valueFormat="currency_k"
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#555]">
            Mortgage Rates
          </h4>
          <MultiLineChart
            data={mortgageData}
            lines={[
              { key: "floating", color: "#c44", label: "Floating" },
              { key: "oneYear", color: "#e68a00", label: "1yr Fixed" },
              { key: "twoYear", color: "#3a8a3a", label: "2yr Fixed" },
            ]}
            height={200}
            valueFormat="percent"
          />
        </div>
      </div>
    </section>
  );
}
