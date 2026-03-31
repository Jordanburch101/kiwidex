import { SectionHeader } from "@workspace/ui/components/section-header";
import { LabourCharts } from "@/components/sections/labour-charts";
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
      <LabourCharts
        medianIncome={medianIncome}
        unemployment={unemployment}
        wageVsCpi={wageVsCpi}
      />
    </section>
  );
}
