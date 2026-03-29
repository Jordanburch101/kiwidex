import { SectionHeader } from "@workspace/ui/components/section-header";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
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
      <MultiLineChart
        data={combinedData}
        height={240}
        lines={[
          { key: "petrol91", color: "#c44", label: "91 Octane" },
          { key: "petrol95", color: "#e68a00", label: "95 Octane" },
          { key: "diesel", color: "#3a8a3a", label: "Diesel" },
        ]}
        valueFormat="currency"
      />
    </section>
  );
}
