import { SectionHeader } from "./section-header";
import { MultiLineChart } from "./deep-dive-chart";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface FuelSectionProps {
  petrol91: TimeSeriesPoint[];
  petrol95: TimeSeriesPoint[];
  diesel: TimeSeriesPoint[];
}

export function FuelSection({
  petrol91,
  petrol95,
  diesel,
}: FuelSectionProps) {
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
    <section className="py-10">
      <SectionHeader title="Fuel" subtitle="NZ retail fuel prices per litre" />
      <MultiLineChart
        data={combinedData}
        lines={[
          { key: "petrol91", color: "#c44", label: "91 Octane" },
          { key: "petrol95", color: "#e68a00", label: "95 Octane" },
          { key: "diesel", color: "#3a8a3a", label: "Diesel" },
        ]}
        height={240}
        valueFormat="currency"
      />
    </section>
  );
}
