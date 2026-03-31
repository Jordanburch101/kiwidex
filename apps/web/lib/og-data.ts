import { getLatestValue, type MetricKey } from "@workspace/db";
import { db } from "@workspace/db/client";
import { formatValue } from "@/lib/data";

const OG_METRICS: { key: MetricKey; label: string }[] = [
  { key: "ocr", label: "OCR" },
  { key: "cpi", label: "CPI" },
  { key: "nzd_usd", label: "NZD/USD" },
  { key: "petrol_91", label: "Petrol 91" },
  { key: "unemployment", label: "Unemployment" },
  { key: "house_price_median", label: "House Price" },
];

export interface OgMetric {
  label: string;
  value: string;
}

export async function getOgMetrics(): Promise<OgMetric[]> {
  const results = await Promise.all(
    OG_METRICS.map(async ({ key, label }) => {
      const latest = await getLatestValue(db, key);
      return {
        label,
        value:
          latest?.value !== undefined && latest?.value !== null
            ? formatValue(key, latest.value)
            : "—",
      };
    })
  );
  return results;
}
