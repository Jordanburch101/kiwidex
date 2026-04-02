import Anthropic from "@anthropic-ai/sdk";
import type { getRecentStories } from "@workspace/db";

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
  excerpt: string;
  source: string;
  title: string;
}

interface MatchResult {
  index: number;
  match: string; // "existing:<id>" | "new" | "standalone"
}

interface ClusterGroup {
  articles: number[];
  headline: string | null;
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
    .map(
      (a, i) =>
        `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}"`
    )
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

function sanitizeTags(tagArrays: string[][]): Tag[][] {
  const validTags = new Set<string>(TAG_TAXONOMY);
  return tagArrays
    .map((tags) => tags.filter((t) => validTags.has(t)) as Tag[])
    .map((tags) => (tags.length > 0 ? tags : ["general-economy" as Tag]));
}

// --- Story Matching ---

type ExistingStory = Awaited<ReturnType<typeof getRecentStories>>[number];

export async function matchArticlesToStories(
  articles: ArticleInput[],
  existingStories: ExistingStory[]
): Promise<{ matches: MatchResult[]; newClusters: ClusterGroup[] }> {
  const matches = await matchAgainstExisting(articles, existingStories);

  const newIndices = matches
    .filter((m) => m.match === "new")
    .map((m) => m.index);

  let newClusters: ClusterGroup[] = [];
  if (newIndices.length >= 2) {
    const newArticles = newIndices.map((i) => ({
      ...articles[i - 1]!,
      originalIndex: i,
    }));
    newClusters = await clusterNewArticles(newArticles);
  }

  return { matches, newClusters };
}

async function matchAgainstExisting(
  articles: ArticleInput[],
  existingStories: ExistingStory[]
): Promise<MatchResult[]> {
  if (existingStories.length === 0) {
    return articles.map((_, i) => ({ index: i + 1, match: "new" }));
  }

  const storyList = existingStories
    .map(
      (s) => `{"id": "${s.id}", "headline": "${s.headline}", "tags": ${s.tags}}`
    )
    .join(",\n  ");

  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}" | Source: ${a.source}`
    )
    .join("\n");

  const prompt = `You are matching new NZ economic news articles to existing stories. A "story" is a real-world event or development covered by multiple outlets.

Existing stories (may be matched):
[
  ${storyList}
]

New articles to classify:
${articleList}

For each article, respond with:
- "existing:<story_id>" if it belongs to an existing story
- "new" if it's a genuinely new story not covered by any existing one
- "standalone" if it's a one-off article unlikely to get multi-outlet coverage

Rules:
- Only match if the articles are about the SAME specific event or development, not just the same broad topic
- "Housing costs rise" and "REINZ median price up 3%" might be the same story; "Housing costs rise" and "Government announces first-home grant" are NOT
- When uncertain, prefer "new" over forcing a match to an existing story
- An article can only belong to one story

Return ONLY a JSON array: [{"index": 1, "match": "existing:rbnz-ocr-hold-apr-2026"}, {"index": 2, "match": "new"}, ...]`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<MatchResult[]>(response);

  if (!parsed || parsed.length !== articles.length) {
    const retryResponse = await callHaiku(prompt);
    const retryParsed = parseJsonFromResponse<MatchResult[]>(retryResponse);

    if (!retryParsed || retryParsed.length !== articles.length) {
      console.warn(
        "[news/ai] Story matching failed after retry, treating all as standalone"
      );
      return articles.map((_, i) => ({ index: i + 1, match: "standalone" }));
    }
    return validateMatches(retryParsed, existingStories);
  }

  return validateMatches(parsed, existingStories);
}

function validateMatches(
  matches: MatchResult[],
  existingStories: ExistingStory[]
): MatchResult[] {
  const validIds = new Set(existingStories.map((s) => s.id));
  return matches.map((m) => {
    if (m.match.startsWith("existing:")) {
      const storyId = m.match.replace("existing:", "");
      if (!validIds.has(storyId)) {
        console.warn(
          `[news/ai] Invalid story ID "${storyId}", treating as new`
        );
        return { ...m, match: "new" };
      }
    }
    return m;
  });
}

async function clusterNewArticles(
  articles: {
    title: string;
    excerpt: string;
    source: string;
    originalIndex: number;
  }[]
): Promise<ClusterGroup[]> {
  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}" | Source: ${a.source}`
    )
    .join("\n");

  const prompt = `These articles were all marked as new stories. Group any that are about the same event or development.

Articles:
${articleList}

Return ONLY a JSON array of groups:
[{"articles": [1, 2], "headline": "Neutral headline for this story"}, {"articles": [3], "headline": null}]
- Generate a neutral, factual headline for groups of 2+ articles
- Single articles get headline: null (we'll use the article's own title)`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<ClusterGroup[]>(response);

  if (!parsed) {
    return articles.map((a) => ({
      articles: [a.originalIndex],
      headline: null,
    }));
  }

  return parsed.map((group) => ({
    articles: group.articles.map((i) => articles[i - 1]?.originalIndex ?? i),
    headline: group.headline,
  }));
}
