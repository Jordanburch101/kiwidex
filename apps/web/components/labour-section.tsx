import { SectionHeader } from "./section-header";
import { AreaChartSection, MultiLineChart } from "./deep-dive-chart";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface LabourSectionProps {
  unemployment: TimeSeriesPoint[];
  wageGrowth: TimeSeriesPoint[];
  cpi: TimeSeriesPoint[];
  medianIncome: TimeSeriesPoint[];
}

export function LabourSection({
  unemployment,
  wageGrowth,
  cpi,
  medianIncome,
}: LabourSectionProps) {
  // Merge wage growth and CPI for comparison
  const dateMap = new Map<
    string,
    { date: string; wages?: number; cpi?: number }
  >();

  for (const p of wageGrowth) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.wages = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of cpi) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.cpi = p.value;
    dateMap.set(p.date, entry);
  }

  const wageVsCpi = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <section className="py-10">
      <SectionHeader
        title="Labour & Income"
        subtitle="Employment and wage trends"
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#555]">
            Wage Growth vs CPI
          </h4>
          <MultiLineChart
            data={wageVsCpi}
            lines={[
              { key: "wages", color: "#3a8a3a", label: "Wage Growth" },
              { key: "cpi", color: "#c44", label: "CPI" },
            ]}
            height={180}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#555]">
            Unemployment Rate
          </h4>
          <AreaChartSection
            data={unemployment}
            color="#e68a00"
            height={180}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium text-[#555]">
            Average Income
          </h4>
          <AreaChartSection
            data={medianIncome}
            color="oklch(0.596 0.145 163.225)"
            height={180}
            valueFormat="currency_k"
          />
        </div>
      </div>
    </section>
  );
}
