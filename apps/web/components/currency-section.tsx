import { SectionHeader } from "./section-header";
import { MultiLineChart } from "./deep-dive-chart";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface CurrencySectionProps {
  nzdUsd: TimeSeriesPoint[];
  nzdAud: TimeSeriesPoint[];
  nzdEur: TimeSeriesPoint[];
}

export function CurrencySection({
  nzdUsd,
  nzdAud,
  nzdEur,
}: CurrencySectionProps) {
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
    <section className="py-10">
      <SectionHeader
        title="Currency & Trade"
        subtitle="NZD exchange rates (12-month daily)"
      />
      <MultiLineChart
        data={fxData}
        lines={[
          { key: "usd", color: "#c44", label: "NZD/USD" },
          { key: "aud", color: "#3a8a3a", label: "NZD/AUD" },
          { key: "eur", color: "#e68a00", label: "NZD/EUR" },
        ]}
        height={240}
        valueFormat="ratio"
      />
    </section>
  );
}
