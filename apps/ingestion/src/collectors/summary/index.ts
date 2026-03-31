import Anthropic from "@anthropic-ai/sdk";
import {
  db,
  getLatestArticles,
  getLatestSummary,
  getLatestValue,
  insertSummary,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
import type { CollectorResult } from "../types";

const INTRO_METRICS: MetricKey[] = [
  "ocr",
  "cpi",
  "nzd_usd",
  "petrol_91",
  "unemployment",
  "wage_growth",
];

const CONTEXT_METRICS: MetricKey[] = [
  "gdp_growth",
  "house_price_median",
  "mortgage_1yr",
  "milk",
  "eggs",
  "bread",
];

function formatMetricValue(metric: MetricKey, value: number): string {
  const meta = METRIC_META[metric];
  switch (meta.unit) {
    case "nzd":
      return `$${value.toLocaleString("en-NZ")}`;
    case "nzd_per_litre":
      return `$${value.toFixed(2)}/L`;
    case "percent":
      return `${value}%`;
    case "ratio":
      return `$${value.toFixed(4)}`;
    default:
      return `$${value.toFixed(2)}`;
  }
}

function describeChanges(
  currentRaw: Record<string, number>,
  previousFormatted: Record<string, string> | null
): { changed: string[]; unchanged: string[] } {
  if (!previousFormatted) {
    return { changed: [], unchanged: [] };
  }

  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const metric of INTRO_METRICS) {
    const current = currentRaw[metric];
    if (current == null) {
      continue;
    }

    const prevStr = previousFormatted[metric];
    const currentStr = formatMetricValue(metric, current);

    if (!prevStr || prevStr === currentStr) {
      unchanged.push(
        `${METRIC_META[metric].label} (${currentStr}) — unchanged`
      );
    } else {
      changed.push(`${METRIC_META[metric].label}: ${prevStr} → ${currentStr}`);
    }
  }

  return { changed, unchanged };
}

function buildPrompt(
  metricValues: Record<string, string>,
  contextValues: Record<string, string>,
  headlines: string[],
  changes: { changed: string[]; unchanged: string[] }
): string {
  const changeGuidance =
    changes.changed.length > 0 || changes.unchanged.length > 0
      ? `
WHAT HAS CHANGED since the last summary (focus your narrative on these):
${changes.changed.length > 0 ? changes.changed.map((c) => `- ${c}`).join("\n") : "- Nothing has moved significantly"}

WHAT IS STATIC (mention briefly for context, don't dwell on these):
${changes.unchanged.map((u) => `- ${u}`).join("\n")}

IMPORTANT: Lead with what's moving. Metrics that haven't changed should be woven in as background context, not presented as news.`
      : "";

  return `You are a financial journalist writing a brief editorial introduction for "The Kiwidex", a New Zealand economy dashboard. Write a single paragraph of MAXIMUM 75 words summarising the current state of the NZ economy.

Style: Newspaper editorial voice — authoritative, measured, slightly literary. The first word MUST be "A" (it renders as a large drop-cap in the UI). Use plain language a general audience would understand. Weave in specific numbers naturally. Don't list metrics mechanically — tell a story that connects the data to what's happening in the news.

Current metric values (rendered as highlighted badges — use ALL of these):
- OCR (Official Cash Rate): ${metricValues.ocr}
- CPI (inflation): ${metricValues.cpi}
- NZD/USD exchange rate: ${metricValues.nzd_usd}
- Petrol 91: ${metricValues.petrol_91}
- Unemployment: ${metricValues.unemployment}
- Wage growth: ${metricValues.wage_growth}

Additional data context:
- GDP growth: ${contextValues.gdp_growth}
- Median house price: ${contextValues.house_price_median}
- 1yr mortgage rate: ${contextValues.mortgage_1yr}
- Milk: ${contextValues.milk}, Eggs: ${contextValues.eggs}, Bread: ${contextValues.bread}
${changeGuidance}

Current news headlines (pick the dominant theme to shape the narrative):
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Format: Return ONLY the paragraph text. Use {metric_name} placeholders where these specific metric values should appear: {ocr}, {cpi}, {nzd_usd}, {petrol_91}, {unemployment}, {wage_growth}. These placeholders will be replaced with styled number badges in the UI.

IMPORTANT: Return ONLY the paragraph. No preamble, no explanation, no markdown, no quotes. MAXIMUM 75 words.`;
}

export default async function collectSummary(): Promise<CollectorResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[summary] ANTHROPIC_API_KEY not set, skipping");
    return [];
  }

  console.log(
    "[summary] Fetching latest metrics, articles, and previous summary..."
  );

  // Fetch all metric values + previous summary in parallel
  const allMetrics = [...INTRO_METRICS, ...CONTEXT_METRICS];
  const [latestValues, articles, previousSummary] = await Promise.all([
    Promise.all(allMetrics.map((m) => getLatestValue(db, m))),
    getLatestArticles(db, 2),
    getLatestSummary(db),
  ]);

  const metricValues: Record<string, string> = {};
  const contextValues: Record<string, string> = {};
  const rawValues: Record<string, number> = {};

  for (let i = 0; i < allMetrics.length; i++) {
    const metric = allMetrics[i]!;
    const latest = latestValues[i];
    const formatted =
      latest?.value == null ? "—" : formatMetricValue(metric, latest.value);

    if (latest?.value != null) {
      rawValues[metric] = latest.value;
    }

    if (INTRO_METRICS.includes(metric)) {
      metricValues[metric] = formatted;
    } else {
      contextValues[metric] = formatted;
    }
  }

  // Compare to previous summary
  const previousMetrics = previousSummary
    ? (JSON.parse(previousSummary.metrics) as Record<string, string>)
    : null;
  const changes = describeChanges(rawValues, previousMetrics);

  if (changes.changed.length > 0) {
    console.log(`[summary] Changes detected: ${changes.changed.join(", ")}`);
  } else {
    console.log("[summary] No metric changes — narrative will lean on news");
  }

  // Fetch recent articles
  const headlines = articles.slice(0, 7).map((a) => `${a.title} (${a.source})`);

  if (headlines.length === 0) {
    console.log("[summary] No articles found, skipping");
    return [];
  }

  const prompt = buildPrompt(metricValues, contextValues, headlines, changes);

  console.log("[summary] Generating intro with Claude Sonnet...");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block?.type !== "text") {
    console.error("[summary] Unexpected response format");
    return [];
  }

  const content = block.text.trim();
  console.log(`[summary] Generated (${content.split(/\s+/).length} words):`);
  console.log(`  ${content.slice(0, 120)}...`);

  // Store in DB
  await insertSummary(db, content, JSON.stringify(metricValues));
  console.log("[summary] Saved to summaries table");

  return [];
}
