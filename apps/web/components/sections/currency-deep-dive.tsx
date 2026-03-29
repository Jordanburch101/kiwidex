import { SectionHeader } from "@workspace/ui/components/section-header";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { getCurrencyChartData } from "@/lib/queries";

export async function CurrencyDeepDive() {
  const { nzdUsd, nzdAud, nzdEur } = await getCurrencyChartData();

  // Merge FX data
  const dateMap = new Map<
    string,
    { date: string; usd?: number; aud?: number; eur?: number }
  >();

  for (const p of nzdUsd) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.usd = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of nzdAud) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.aud = p.value;
    dateMap.set(p.date, entry);
  }
  for (const p of nzdEur) {
    const entry = dateMap.get(p.date) ?? { date: p.date };
    entry.eur = p.value;
    dateMap.set(p.date, entry);
  }

  const fxData = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="NZD exchange rates (12-month daily)"
        title="Currency & Trade"
      />
      <MultiLineChart
        data={fxData}
        height={240}
        lines={[
          { key: "usd", color: "#c44", label: "NZD/USD" },
          { key: "aud", color: "#3a8a3a", label: "NZD/AUD" },
          { key: "eur", color: "#e68a00", label: "NZD/EUR" },
        ]}
        valueFormat="ratio"
      />
    </section>
  );
}
