import Anthropic from "@anthropic-ai/sdk";
import { METRIC_META, type MetricKey } from "@workspace/db";

interface StoryArticle {
  content: string | null;
  excerpt: string;
  source: string;
  title: string;
}

interface EnrichmentResult {
  angles: { source: string; angle: string; description: string }[];
  relatedMetrics: MetricKey[];
  summary: string;
}

const VALID_METRICS = new Set(Object.keys(METRIC_META));

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  return new Anthropic({ apiKey });
}

export async function enrichStory(
  headline: string,
  articles: StoryArticle[]
): Promise<EnrichmentResult | null> {
  const isMultiSource = articles.length > 1;

  const articleList = articles
    .map((a) => {
      const body = a.content ? a.content.slice(0, 1500) : a.excerpt;
      return `- [${a.source.toUpperCase()}] "${a.title}" — ${body}`;
    })
    .join("\n\n");

  const anglesInstruction = isMultiSource
    ? `2. **angles**: For each source, a short label (2-3 words) and one-sentence description of their reporting angle. Categories like "Policy focus", "Consumer impact", "Market analysis", "Human interest", "Data-driven", "Industry perspective".`
    : "2. **angles**: Return an empty array [] (single-source story).";

  const prompt = `You are analysing a NZ economic news story for The Kiwidex, an NZ economy dashboard.

Story headline: "${headline}"

Source articles:
${articleList}

Generate:
1. **summary**: 2-4 paragraphs synthesising the story${isMultiSource ? " across all sources" : ""}. Write as flowing editorial prose, like a newspaper brief. Highlight key facts, figures, and data points. Do not use bullet points or markdown lists. Separate paragraphs with double newlines.

${anglesInstruction}

3. **relatedMetrics**: Which dashboard metrics does this story relate to — directly OR indirectly? Think broadly about economic impact. A story about household budgets relates to grocery prices (milk, eggs, bread, etc.) and CPI. A story about fuel supply relates to petrol_91, petrol_95, petrol_diesel. A story about jobs relates to unemployment and wage_growth. Always include at least 1-2 metrics. Pick from: ocr, cpi, gdp_growth, unemployment, wage_growth, median_income, house_price_median, house_price_index, mortgage_floating, mortgage_1yr, mortgage_2yr, nzd_usd, nzd_aud, nzd_eur, petrol_91, petrol_95, petrol_diesel, electricity_wholesale, milk, eggs, bread, butter, cheese, bananas, nzx_50, minimum_wage

Return ONLY valid JSON:
{
  "summary": "First paragraph of prose.\\n\\nSecond paragraph of prose.",
  "angles": [{"source": "rnz", "angle": "Policy focus", "description": "..."}],
  "relatedMetrics": ["ocr", "mortgage_1yr"]
}`;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    console.warn(
      "[news/enrich] Failed to parse Sonnet response for:",
      headline
    );
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as EnrichmentResult;

    parsed.relatedMetrics = parsed.relatedMetrics.filter((m) =>
      VALID_METRICS.has(m)
    ) as MetricKey[];

    const validSources = new Set(articles.map((a) => a.source));
    parsed.angles = parsed.angles.filter((a) => validSources.has(a.source));

    return parsed;
  } catch {
    console.warn("[news/enrich] JSON parse error for:", headline);
    return null;
  }
}
