const SILENCE_THRESHOLD_DAYS = 5;
const SUMMARY_CAP = 5;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "it",
  "its",
  "this",
  "that",
  "and",
  "or",
  "but",
  "not",
  "will",
  "would",
  "could",
  "should",
  "may",
  "can",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "how",
  "why",
  "what",
  "when",
  "who",
  "which",
  "where",
  "than",
  "more",
  "most",
  "very",
  "just",
  "also",
  "says",
  "said",
  "new",
  "after",
  "over",
  "into",
  "up",
  "out",
  "about",
  "no",
  "all",
  "some",
  "if",
  "so",
  "we",
  "our",
  "they",
  "their",
  "nz",
  "zealand",
]);

interface CandidateStory {
  headline: string;
  id: string;
  tags: string[];
}

interface ArticleForMatching {
  content: string | null;
  tags: string[];
  title: string;
}

type MatchCategory =
  | { category: "NO_CANDIDATES" }
  | { category: "HIGH_CONFIDENCE"; matchedStoryId: string }
  | { category: "AMBIGUOUS"; candidates: CandidateStory[] };

export function findStoriesToClose(
  stories: { id: string; updatedAt: string; summaryCount: number }[]
): { id: string; reason: "expired" | "cap_reached" }[] {
  const now = Date.now();
  const results: { id: string; reason: "expired" | "cap_reached" }[] = [];

  for (const story of stories) {
    const silenceDays =
      (now - new Date(story.updatedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (story.summaryCount >= SUMMARY_CAP) {
      results.push({ id: story.id, reason: "cap_reached" });
    } else if (silenceDays >= SILENCE_THRESHOLD_DAYS) {
      results.push({ id: story.id, reason: "expired" });
    }
  }

  return results;
}

function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

export function computeWordSimilarity(textA: string, textB: string): number {
  const wordsA = extractSignificantWords(textA);
  const wordsB = extractSignificantWords(textB);
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      overlap++;
    }
  }
  return overlap;
}

export function categorizeArticle(
  article: ArticleForMatching,
  openStories: CandidateStory[]
): MatchCategory {
  if (openStories.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  const articleText = `${article.title} ${(article.content ?? "").slice(0, 500)}`;
  const scored: {
    story: CandidateStory;
    similarity: number;
    tagOverlap: number;
  }[] = [];

  for (const story of openStories) {
    const storyText = `${story.headline} ${story.tags.join(" ")}`;
    const similarity = computeWordSimilarity(articleText, storyText);
    const tagOverlap = article.tags.filter((t) =>
      story.tags.includes(t)
    ).length;

    if (similarity > 0 || tagOverlap > 0) {
      scored.push({ story, similarity, tagOverlap });
    }
  }

  if (scored.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  scored.sort((a, b) => b.similarity - a.similarity);

  if (scored[0]!.similarity >= 3) {
    return {
      category: "HIGH_CONFIDENCE",
      matchedStoryId: scored[0]!.story.id,
    };
  }

  return {
    category: "AMBIGUOUS",
    candidates: scored.slice(0, 3).map((s) => s.story),
  };
}
