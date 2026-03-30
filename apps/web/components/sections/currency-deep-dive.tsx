import { SectionHeader } from "@workspace/ui/components/section-header";
import { CurrencyCharts } from "@/components/sections/currency-charts";
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
        subtitle="NZD exchange rates (daily)"
        title="Currency & Trade"
      />
      <CurrencyCharts data={fxData} />
    </section>
  );
}
