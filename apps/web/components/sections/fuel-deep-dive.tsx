import { SectionHeader } from "@workspace/ui/components/section-header";
import { FuelCharts } from "@/components/sections/fuel-charts";
import { getFuelChartData } from "@/lib/queries";

export async function FuelDeepDive() {
  const { petrol91, petrol95, diesel } = await getFuelChartData();

  // Merge time series into multi-line format
  const dateMap = new Map<
    string,
    { date: string; petrol91?: number; petrol95?: number; diesel?: number }
  >();

  for (const p of petrol91) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.petrol91 = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of petrol95) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.petrol95 = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of diesel) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.diesel = p.value;
    dateMap.set(p.date, entry);
  }

  const combinedData = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <section className="px-6 py-10">
      <SectionHeader subtitle="NZ retail fuel prices per litre" title="Fuel" />
      <FuelCharts data={combinedData} />
    </section>
  );
}
