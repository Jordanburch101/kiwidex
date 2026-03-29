import {
  getLatestByCategory,
  METRIC_CATEGORIES,
  METRIC_META,
  type MetricKey,
  type MetricCategory,
} from "@workspace/db";
import { db } from "@workspace/db/client";

function formatValue(metric: MetricKey, value: number): string {
  const meta = METRIC_META[metric];
  switch (meta.unit) {
    case "nzd":
      return `$${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "nzd_per_litre":
      return `$${value.toFixed(3)}/L`;
    case "nzd_per_kwh":
      return `$${value.toFixed(4)}/kWh`;
    case "nzd_per_week":
      return `$${value.toFixed(0)}/wk`;
    case "nzd_per_hour":
      return `$${value.toFixed(2)}/hr`;
    case "percent":
      return `${value.toFixed(2)}%`;
    case "ratio":
      return value.toFixed(4);
    default:
      return value.toString();
  }
}

async function CategorySection({ category }: { category: MetricCategory }) {
  const data = await getLatestByCategory(db, category);

  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-4 font-heading text-xl font-semibold">
        {METRIC_CATEGORIES[category]}
      </h2>
      {data.length === 0 ? (
        <p className="text-muted-foreground font-mono text-sm">No data yet</p>
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-left text-xs">
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Date</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.metric} className="border-border border-t">
                  <td className="px-3 py-2">
                    {METRIC_META[row.metric as MetricKey]?.label ?? row.metric}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatValue(row.metric as MetricKey, row.value)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right font-mono text-xs">
                    {row.date}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {row.source ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Page() {
  const categories = Object.keys(METRIC_CATEGORIES) as MetricCategory[];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">NZ Economy Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Placeholder view — verifying data pipeline
        </p>
      </header>
      {categories.map((category) => (
        <CategorySection key={category} category={category} />
      ))}
    </div>
  );
}
