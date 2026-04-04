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

// --- Per-Article Story Matching (Structured CoT via tool_use) ---

interface MatchClassification {
  article_event: string;
  best_match_event: string;
  confidence: "high" | "medium" | "low";
  decision: "continuation" | "chapter_from" | "new" | "standalone";
  match_index: number;
  same_event_or_same_topic: "same_event" | "same_topic" | "unrelated";
}

const CLASSIFY_TOOL = {
  name: "classify_article",
  description: "Classify how a news article relates to an existing story",
  input_schema: {
    type: "object" as const,
    properties: {
      article_event: {
        type: "string" as const,
        description:
          "The specific event/action the new article reports (one sentence)",
      },
      best_match_event: {
        type: "string" as const,
        description:
          "The specific event/action the best candidate story covers (one sentence)",
      },
      same_event_or_same_topic: {
        type: "string" as const,
        enum: ["same_event", "same_topic", "unrelated"],
        description:
          "Same event = same trigger, actors, timeframe. Same topic = related subject area but different trigger.",
      },
      decision: {
        type: "string" as const,
        enum: ["continuation", "chapter_from", "new", "standalone"],
      },
      match_index: {
        type: "integer" as const,
        description:
          "1-indexed candidate number (required for continuation/chapter_from, 0 for new/standalone)",
      },
      confidence: {
        type: "string" as const,
        enum: ["high", "medium", "low"],
        description: "How confident are you in this classification?",
      },
    },
    required: [
      "article_event",
      "best_match_event",
      "same_event_or_same_topic",
      "decision",
      "match_index",
      "confidence",
    ],
  },
};

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

  const prompt = `You are classifying whether a new NZ economic news article belongs to an existing story.

<article>
Title: "${article.title}"
Content: "${articleContent}"
Source: ${article.source}
</article>

<candidate_stories>
${candidateList}
</candidate_stories>

<definitions>
- "continuation" — This article covers the SAME EVENT as an existing story. Same triggering incident, same key actors, same timeframe. A reader who saw the existing story would say "I already know about this — this is the same news from another outlet."
- "chapter_from" — A genuinely major NEW development caused by or in direct response to an existing story. Different trigger, new actors taking new actions. Rare — maybe 1 in 20 articles.
- "new" — This is a DIFFERENT EVENT, even if it's in the same topic area. A reader would say "oh, that's a separate thing happening."
- "standalone" — A one-off report (data release, survey result) unlikely to develop further.
</definitions>

<rules>
- Two articles about "fuel prices" are NOT automatically the same story. One could be about a specific price hike and another about a government tax review — those are different events.
- Different outlets covering the SAME press conference, announcement, or data release IS a continuation.
- Articles that share a broad topic (housing, employment, inflation) but describe different actions by different actors are DIFFERENT STORIES.
- When uncertain between continuation and new: prefer "new". It is better to have two similar stories than one bloated super-story that merges unrelated events.
</rules>

<examples>
CONTINUATION: Article "Herald: Petrol climbs 5c as margins tighten" → Story "Petrol prices surge amid refinery squeeze"
Why: Same price movement, same actors (fuel companies), same timeframe. Different outlet covering same event.

NOT A CONTINUATION: Article "Stuff: Government announces fuel tax review" → Story "Petrol prices surge amid refinery squeeze"
Why: Different trigger (policy announcement vs price movement), different actor (government vs fuel companies). This is a NEW story even though both involve fuel.

CONTINUATION: Article "RNZ: Reserve Bank holds OCR at 4.25%, signals cuts ahead" → Story "RBNZ holds rates steady, hints at future easing"
Why: Same OCR decision announcement, different outlet covering the same central bank decision.

NOT A CONTINUATION: Article "Interest.co.nz: Mortgage rates drop as banks compete for borrowers" → Story "RBNZ holds rates steady"
Why: Banks independently lowering mortgage rates is a separate commercial decision with different actors (banks vs RBNZ).
</examples>

Use the classify_article tool to respond.`;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool" as const, name: "classify_article" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return "new";
  }

  const result = toolBlock.input as MatchClassification;

  // Confidence gating: low confidence continuations become "new"
  // This prevents the gravity well of broad stories absorbing everything
  if (result.confidence === "low" && result.decision === "continuation") {
    console.log(
      `[news/ai] Low-confidence continuation for "${article.title}" → defaulting to "new"`
    );
    return "new";
  }

  // Same-topic but different-event should not be a continuation
  if (
    result.same_event_or_same_topic === "same_topic" &&
    result.decision === "continuation"
  ) {
    console.log(
      `[news/ai] Same-topic-not-same-event for "${article.title}" → defaulting to "new"`
    );
    return "new";
  }

  if (
    result.decision === "continuation" &&
    result.match_index >= 1 &&
    result.match_index <= candidates.length
  ) {
    return `continuation:${candidates[result.match_index - 1]!.id}`;
  }
  if (
    result.decision === "chapter_from" &&
    result.match_index >= 1 &&
    result.match_index <= candidates.length
  ) {
    return `chapter_from:${candidates[result.match_index - 1]!.id}`;
  }
  if (result.decision === "standalone") {
    return "standalone";
  }
  return "new";
}
