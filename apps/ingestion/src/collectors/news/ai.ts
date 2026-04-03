import Anthropic from "@anthropic-ai/sdk";

export const TAG_TAXONOMY = [
  "housing",
  "employment",
  "fuel",
  "groceries",
  "currency",
  "markets",
  "interest-rates",
  "inflation",
  "government",
  "trade",
  "general-economy",
] as const;

export type Tag = (typeof TAG_TAXONOMY)[number];

interface ArticleInput {
  content: string | null;
  excerpt: string;
  source: string;
  title: string;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  return new Anthropic({ apiKey });
}

async function callHaiku(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

function parseJsonFromResponse<T>(text: string): T | null {
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!jsonMatch?.[1]) {
    return null;
  }
  try {
    return JSON.parse(jsonMatch[1]) as T;
  } catch {
    return null;
  }
}

// --- Article Tagging ---

export async function tagArticles(articles: ArticleInput[]): Promise<Tag[][]> {
  const articleList = articles
    .map((a, i) => {
      const text = a.content ? a.content.slice(0, 400) : a.excerpt;
      return `${i + 1}. Title: "${a.title}" | Content: "${text}"`;
    })
    .join("\n");

  const prompt = `You are tagging NZ economic news articles. For each article, assign 1-3 tags from this taxonomy:
${TAG_TAXONOMY.join(", ")}

Return ONLY a JSON array where each element is an array of tags for the corresponding article (by index). Example: [["housing", "interest-rates"], ["fuel"], ["employment", "government"]]

Articles:
${articleList}`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<string[][]>(response);

  if (!parsed || parsed.length !== articles.length) {
    const retryResponse = await callHaiku(prompt);
    const retryParsed = parseJsonFromResponse<string[][]>(retryResponse);

    if (!retryParsed || retryParsed.length !== articles.length) {
      console.warn(
        "[news/ai] Tagging failed after retry, falling back to general-economy"
      );
      return articles.map(() => ["general-economy" as Tag]);
    }
    return sanitizeTags(retryParsed);
  }

  return sanitizeTags(parsed);
}

export function sanitizeTags(tagArrays: string[][]): Tag[][] {
  const validTags = new Set<string>(TAG_TAXONOMY);
  return tagArrays
    .map((tags) => tags.filter((t) => validTags.has(t)) as Tag[])
    .map((tags) => (tags.length > 0 ? tags : ["general-economy" as Tag]));
}

// --- Per-Article Story Matching ---

export async function matchArticleToStory(
  article: { title: string; content: string | null; source: string },
  candidates: { id: string; headline: string; tags: string[] }[]
): Promise<
  "new" | "standalone" | `continuation:${string}` | `chapter_from:${string}`
> {
  const articleContent = (article.content ?? "").slice(0, 300);
  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.headline}" (tags: ${c.tags.join(", ")})`)
    .join("\n");

  const prompt = `You are matching a new NZ economic news article to existing stories.

Article: "${article.title}"
Content: "${articleContent}"
Source: ${article.source}

Existing stories this MIGHT belong to:
${candidateList}

Respond with ONE of:
- "continuation:N" — this article is about the same development as story N
- "chapter_from:N" — this is a MAJOR new development related to story N (e.g., government response to an ongoing crisis). Warrants its own story but linked to N.
- "new" — this is unrelated to any listed story
- "standalone" — this is a one-off article unlikely to develop further

Rules:
- "continuation" = same event, same development, just another outlet covering it
- "chapter_from" = a significant escalation, response, or shift in an ongoing story
- When uncertain, prefer "new" over forcing a match
- Only use "chapter_from" for genuinely major developments, not routine follow-ups

Return ONLY the decision string, nothing else.`;

  const response = await callHaiku(prompt);
  const cleaned = response.trim().toLowerCase();

  if (cleaned.startsWith("continuation:")) {
    const idx = Number.parseInt(cleaned.replace("continuation:", ""), 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return `continuation:${candidates[idx]!.id}`;
    }
  }
  if (cleaned.startsWith("chapter_from:")) {
    const idx = Number.parseInt(cleaned.replace("chapter_from:", ""), 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return `chapter_from:${candidates[idx]!.id}`;
    }
  }
  if (cleaned === "standalone") {
    return "standalone";
  }
  return "new";
}
