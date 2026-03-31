import { SectionHeader } from "@workspace/ui/components/section-header";
import { AreaChartSection } from "@/components/charts/area-chart";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { LABOUR_COLORS } from "@/lib/colors";
import { getLabourChartData } from "@/lib/queries";

export async function LabourDeepDive() {
  const { unemployment, wageGrowth, cpi, medianIncome } =
    await getLabourChartData();

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
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Employment and wage trends"
        title="Labour & Income"
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Wage Growth vs CPI
          </h4>
          <MultiLineChart
            data={wageVsCpi}
            height={180}
            lines={[
              {
                key: "wages",
                color: LABOUR_COLORS.wageGrowth,
                label: "Wage Growth",
              },
              { key: "cpi", color: LABOUR_COLORS.cpi, label: "CPI" },
            ]}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Unemployment Rate
          </h4>
          <AreaChartSection
            color={LABOUR_COLORS.unemployment}
            data={unemployment}
            height={180}
            valueFormat="percent"
          />
        </div>
        <div>
          <h4 className="mb-2 font-medium text-[#555] text-sm">
            Average Income
          </h4>
          <AreaChartSection
            color="oklch(0.596 0.145 163.225)"
            data={medianIncome}
            height={180}
            valueFormat="currency_k"
          />
        </div>
      </div>
    </section>
  );
}
