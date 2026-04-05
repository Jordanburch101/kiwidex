import { extractSignificantWords } from "./stop-words";

const SILENCE_THRESHOLD_DAYS = 5;
const SUMMARY_CAP = 5;
const MAX_ARTICLES_PER_STORY = 12;

interface CandidateStory {
  articleCount?: number;
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

/**
 * Detect when a story's current headline has drifted so far from its original
 * slug that the story should chapter. The slug is frozen at creation time, so
 * if the headline evolves (e.g., "fuel prices rise" → "government announces
 * relief package"), the Jaccard between slug words and headline words drops.
 *
 * Returns true when the story identity has fundamentally shifted.
 */
export function hasSlugDrifted(
  storyId: string,
  currentHeadline: string
): boolean {
  // Strip the month-year suffix from the slug to get the original headline words
  const slugBase = storyId.replace(/-[a-z]{3}-\d{4}$/, "");
  const slugWords = extractSignificantWords(slugBase.replace(/-/g, " "));
  const headlineWords = extractSignificantWords(currentHeadline);

  if (slugWords.size === 0 || headlineWords.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const word of slugWords) {
    if (headlineWords.has(word)) {
      overlap++;
    }
  }

  // Use Jaccard on slug vs headline — below 0.08 means they share almost nothing
  const union = new Set([...slugWords, ...headlineWords]).size;
  const jaccard = union === 0 ? 0 : overlap / union;
  return jaccard < 0.08;
}

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

export function computeJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = extractSignificantWords(textA);
  const wordsB = extractSignificantWords(textB);
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      overlap++;
    }
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : overlap / union;
}

/**
 * Jaccard threshold for HIGH_CONFIDENCE auto-assign.
 * 0.10 — tuned empirically: fuel crisis articles score 0.15-0.25 between each other,
 * while tangentially related articles score 0.06-0.09. This threshold lets genuinely
 * related articles auto-cluster while keeping distinct stories separate.
 */
const JACCARD_HIGH_CONFIDENCE = 0.1;

/**
 * Minimum Jaccard to even consider a story as a candidate (AMBIGUOUS).
 * Below this, the overlap is too thin to bother sending to the AI.
 * 0.04 catches articles that share 1-2 discriminating words with a story.
 */
const JACCARD_CANDIDATE_FLOOR = 0.04;

export function categorizeArticle(
  article: ArticleForMatching,
  openStories: CandidateStory[]
): MatchCategory {
  if (openStories.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  // Use title-to-headline for Jaccard (avoids union inflation from body text)
  // Content is included in raw word overlap as a secondary signal
  const scored: {
    jaccard: number;
    rawOverlap: number;
    story: CandidateStory;
    tagOverlap: number;
  }[] = [];

  for (const story of openStories) {
    const storyText = `${story.headline} ${story.tags.join(" ")}`;
    // Jaccard on titles only — keeps union small and ratio meaningful
    const jaccard = computeJaccardSimilarity(article.title, storyText);
    // Raw overlap includes content for broader signal
    const articleFull = `${article.title} ${(article.content ?? "").slice(0, 500)}`;
    const rawOverlap = computeWordSimilarity(articleFull, storyText);
    const tagOverlap = article.tags.filter((t) =>
      story.tags.includes(t)
    ).length;

    // Require meaningful similarity OR at least 2 shared tags
    if (jaccard >= JACCARD_CANDIDATE_FLOOR || tagOverlap >= 2) {
      scored.push({ story, jaccard, rawOverlap, tagOverlap });
    }
  }

  if (scored.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  // Sort by Jaccard descending, break ties with raw overlap, then tag overlap
  scored.sort(
    (a, b) =>
      b.jaccard - a.jaccard ||
      b.rawOverlap - a.rawOverlap ||
      b.tagOverlap - a.tagOverlap
  );

  const best = scored[0]!;

  // Stories at article cap never get auto-assigned — force through AI or skip
  const atCap =
    best.story.articleCount !== undefined &&
    best.story.articleCount >= MAX_ARTICLES_PER_STORY;

  // Broad stories (4+ tags) require higher similarity for auto-assign
  const isBroad = best.story.tags.length >= 4;

  // HIGH_CONFIDENCE paths (title Jaccard OR strong content overlap + tag match)
  if (!(atCap || isBroad)) {
    if (best.jaccard >= JACCARD_HIGH_CONFIDENCE) {
      return {
        category: "HIGH_CONFIDENCE",
        matchedStoryId: best.story.id,
      };
    }
    // Fallback: content has 3+ shared words AND at least 1 tag overlaps
    if (best.rawOverlap >= 3 && best.tagOverlap >= 1) {
      return {
        category: "HIGH_CONFIDENCE",
        matchedStoryId: best.story.id,
      };
    }
  }

  // For broad stories, require higher Jaccard for auto-assign
  if (
    !atCap &&
    isBroad &&
    best.jaccard >= JACCARD_HIGH_CONFIDENCE * 1.5 &&
    best.tagOverlap >= 1
  ) {
    return {
      category: "HIGH_CONFIDENCE",
      matchedStoryId: best.story.id,
    };
  }

  // Stories at article cap are excluded from candidates — force new story creation
  const candidates = scored
    .filter(
      (s) =>
        !s.story.articleCount || s.story.articleCount < MAX_ARTICLES_PER_STORY
    )
    .slice(0, 3)
    .map((s) => s.story);

  if (candidates.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  return {
    category: "AMBIGUOUS",
    candidates,
  };
}
