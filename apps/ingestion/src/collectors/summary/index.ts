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

/** Metrics eligible for inline {badge} placeholders in the summary */
const INTRO_METRICS: MetricKey[] = [
  "ocr",
  "cpi",
  "nzd_usd",
  "petrol_91",
  "unemployment",
  "wage_growth",
  "nzx_50",
];

/** Background context — never shown as badges but fed to the model */
const CONTEXT_METRICS: MetricKey[] = [
  "gdp_growth",
  "house_price_median",
  "mortgage_1yr",
  "milk",
  "eggs",
  "bread",
  "butter",
  "cheese",
  "bananas",
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

/**
 * Minimum % change required for a metric move to be considered "significant".
 * Anything below this threshold is treated as noise.
 */
const SIGNIFICANCE_THRESHOLDS: Partial<Record<MetricKey, number>> = {
  ocr: 5, // 25bp on a 5% rate
  cpi: 3, // quarterly, rarely moves
  unemployment: 3,
  wage_growth: 5,
  nzd_usd: 1.5, // FX moves daily
  petrol_91: 2, // ~5c on $2.50/L
  nzx_50: 1, // ~120 pts on ~12,000
  milk: 5, // ~25c on $5
  eggs: 5,
  bread: 5,
  butter: 5,
  cheese: 5,
  bananas: 5,
};

function describeChanges(
  currentRaw: Record<string, number>,
  previousRaw: Record<string, number> | null
): { changed: string[]; unchanged: string[]; movedKeys: Set<string> } {
  if (!previousRaw) {
    return { changed: [], unchanged: [], movedKeys: new Set() };
  }

  const changed: string[] = [];
  const unchanged: string[] = [];
  const movedKeys = new Set<string>();

  const allTracked = [...INTRO_METRICS, ...CONTEXT_METRICS];

  for (const metric of allTracked) {
    const current = currentRaw[metric];
    const previous = previousRaw[metric];
    if (current == null) {
      continue;
    }

    const currentStr = formatMetricValue(metric, current);

    if (previous == null) {
      unchanged.push(
        `${METRIC_META[metric].label} (${currentStr}) — no prior data`
      );
      continue;
    }

    const pctChange =
      previous === 0 ? 0 : Math.abs((current - previous) / previous) * 100;
    const threshold = SIGNIFICANCE_THRESHOLDS[metric] ?? 2;

    if (pctChange < threshold) {
      unchanged.push(
        `${METRIC_META[metric].label} (${currentStr}) — unchanged`
      );
    } else {
      const direction = current > previous ? "↑" : "↓";
      const prevStr = formatMetricValue(metric, previous);
      changed.push(
        `${METRIC_META[metric].label}: ${prevStr} → ${currentStr} (${direction}${pctChange.toFixed(1)}%)`
      );
      movedKeys.add(metric);
    }
  }

  return { changed, unchanged, movedKeys };
}

const BADGE_LABELS: Record<string, string> = {
  ocr: "OCR (Official Cash Rate)",
  cpi: "CPI (inflation)",
  nzd_usd: "NZD/USD exchange rate",
  petrol_91: "Petrol 91",
  unemployment: "Unemployment",
  wage_growth: "Wage growth",
  nzx_50: "NZX 50 index",
};

function buildPrompt(
  metricValues: Record<string, string>,
  contextValues: Record<string, string>,
  headlines: string[],
  changes: { changed: string[]; unchanged: string[] },
  movedMetrics: Set<string>
): string {
  const hasChanges = changes.changed.length > 0;

  const changeSection = hasChanges
    ? `SIGNIFICANT MOVES (lead your narrative with these — this is the news):
${changes.changed.map((c) => `- ${c}`).join("\n")}

STATIC BACKGROUND (weave in briefly if relevant, do NOT treat as news):
${changes.unchanged.map((u) => `- ${u}`).join("\n")}`
    : `NO METRICS HAVE MOVED SIGNIFICANTLY.
All current values: ${changes.unchanged.map((u) => `- ${u}`).join("\n")}

Since nothing has moved, your narrative MUST be driven entirely by the news headlines below. Reference 1-2 metrics only as supporting context for the news story.`;

  // Split badge metrics into moved vs static — model sees moved first
  const movedBadges: string[] = [];
  const staticBadges: string[] = [];
  for (const [key, val] of Object.entries(metricValues)) {
    const label = BADGE_LABELS[key] ?? key;
    const line = `- ${label}: ${val} → use {${key}}`;
    if (movedMetrics.has(key)) {
      movedBadges.push(line);
    } else {
      staticBadges.push(line);
    }
  }

  const badgePlaceholders = Object.keys(metricValues)
    .map((k) => `{${k}}`)
    .join(", ");

  const badgeSection =
    movedBadges.length > 0
      ? `PREFERRED badge metrics (these MOVED — use these first):
${movedBadges.join("\n")}

Other available badges (static — only use if directly relevant to the news angle):
${staticBadges.join("\n")}`
      : `Available badge metrics (all static — pick 2-3 that best support the news story):
${staticBadges.join("\n")}`;

  return `You are a financial journalist writing a brief editorial introduction for "The Kiwidex", a New Zealand economy dashboard. Write a single paragraph of MAXIMUM 75 words.

Style: Newspaper editorial voice — authoritative, measured, slightly literary. The first word MUST be "A" (it renders as a large drop-cap in the UI). Use plain language a general audience would understand.

NARRATIVE PRIORITY (follow this order):
1. News headlines — these set the story angle
2. Metrics that have significantly moved — weave these in as evidence
3. Static metrics — mention at most 1-2 for context, never as the lead

${changeSection}

News headlines (pick the dominant theme — this should DRIVE your angle):
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

${badgeSection}

Additional data context (no badges, but use to inform your narrative):
- GDP growth: ${contextValues.gdp_growth}
- Median house price: ${contextValues.house_price_median}
- 1yr mortgage rate: ${contextValues.mortgage_1yr}
- Groceries: Milk ${contextValues.milk}, Eggs ${contextValues.eggs}, Bread ${contextValues.bread}, Butter ${contextValues.butter}, Cheese ${contextValues.cheese}, Bananas ${contextValues.bananas}

Format: Return ONLY the paragraph. Use {metric_name} placeholders where badge values should appear (available: ${badgePlaceholders}). Use at least 2 badges, preferring MOVED metrics over static ones. No preamble, no markdown, no quotes. MAXIMUM 75 words.`;
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

  // Compare to previous summary (parse raw numbers for threshold comparison)
  let previousRaw: Record<string, number> | null = null;
  if (previousSummary) {
    const parsed = JSON.parse(previousSummary.metrics) as Record<
      string,
      string | number
    >;
    previousRaw = {};
    for (const [key, val] of Object.entries(parsed)) {
      // Handle both raw numbers (new format) and formatted strings (legacy)
      const num =
        typeof val === "number"
          ? val
          : Number.parseFloat(String(val).replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(num)) {
        previousRaw[key] = num;
      }
    }
  }
  const changes = describeChanges(rawValues, previousRaw);

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

  const prompt = buildPrompt(
    metricValues,
    contextValues,
    headlines,
    changes,
    changes.movedKeys
  );

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

  // Store in DB — save raw numeric values for accurate future comparison
  await insertSummary(db, content, JSON.stringify(rawValues));
  console.log("[summary] Saved to summaries table");

  return [];
}
