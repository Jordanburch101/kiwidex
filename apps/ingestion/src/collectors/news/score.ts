import { getKeywordTier } from "./keywords";
import { computeWordSimilarity } from "./lifecycle";
import type { ParsedArticle } from "./parse-rss";
import { extractSignificantWords } from "./stop-words";

export interface ScoredArticle extends ParsedArticle {
  score: number;
}

export interface OpenStoryHint {
  headline: string;
  id: string;
}

/**
 * Score articles by importance for lead selection. Higher = more important.
 *
 * Designed for 1-2x daily scraping where recency barely differentiates.
 * Cross-source coverage and continuation of existing stories are the
 * strongest signals — multi-source stories are the day's biggest news,
 * and updates to tracked stories keep the dashboard current.
 *
 * Factors (max ~155):
 * 1. Keyword tier from TITLE only (max 30) — topic importance
 * 2. Headline focus — keyword density in title (max 20)
 * 3. Cross-source coverage — multiple outlets on same story (max 50)
 * 4. Continues existing story — updates a tracked story (max 30)
 * 5. Breaking/urgency language in title (max 15)
 * 6. Recency — tiebreaker only (max 10)
 * 7. Has image — better lead visually (max 5)
 */
export function scoreArticles(
  articles: ParsedArticle[],
  openStories: OpenStoryHint[] = []
): ScoredArticle[] {
  const storyClusters = buildStoryClusters(articles);

  return articles.map((article) => {
    const tierScore = getTitleKeywordTierScore(article);
    const focusScore = getHeadlineFocusScore(article);
    const coverageScore = getStoryCoverageScore(article, storyClusters);
    const continuationScore = getContinuationScore(article, openStories);
    const urgencyScore = getUrgencyScore(article);
    const recencyScore = getRecencyTiebreaker(article);
    const imageScore = article.imageUrl ? 5 : 0;

    return {
      ...article,
      score:
        tierScore +
        focusScore +
        coverageScore +
        continuationScore +
        urgencyScore +
        recencyScore +
        imageScore,
    };
  });
}

// --- Factor 1: Keyword tier from TITLE only (max 30) ---

function getTitleKeywordTierScore(article: ParsedArticle): number {
  // Score based on title keywords only — not excerpt
  const tier = getKeywordTier(article.title, "");
  if (tier === 1) {
    return 30;
  }
  if (tier === 2) {
    return 20;
  }
  if (tier === 3) {
    return 10;
  }
  // Fallback: check excerpt for a smaller bonus
  const excerptTier = getKeywordTier("", article.excerpt);
  if (excerptTier === 1) {
    return 15;
  }
  if (excerptTier === 2) {
    return 10;
  }
  return 5;
}

// --- Factor 2: Headline focus — keyword density in title (max 20) ---

const ALL_ECONOMY_TERMS = [
  "ocr",
  "rbnz",
  "reserve bank",
  "monetary policy",
  "gdp",
  "cpi",
  "recession",
  "cash rate",
  "fiscal",
  "budget",
  "interest rate",
  "inflation",
  "mortgage",
  "house price",
  "housing",
  "unemployment",
  "employment",
  "labour market",
  "property",
  "cost of living",
  "exchange rate",
  "petrol",
  "fuel",
  "diesel",
  "grocery",
  "supermarket",
  "wage",
  "income",
  "economy",
  "trade",
  "currency",
  "nzd",
  "rent",
];

function getHeadlineFocusScore(article: ParsedArticle): number {
  const title = article.title.toLowerCase();
  let count = 0;
  for (const term of ALL_ECONOMY_TERMS) {
    if (title.includes(term)) {
      count++;
    }
  }
  if (count >= 3) {
    return 20;
  }
  if (count === 2) {
    return 12;
  }
  if (count === 1) {
    return 5;
  }
  return 0;
}

// --- Factor 3: Cross-source coverage (max 45) ---

interface StoryCluster {
  articles: ParsedArticle[];
  sources: Set<string>;
}

/**
 * Group articles into story clusters based on shared significant words.
 * Two articles are about the same story if they share 2+ significant words
 * in their titles (after removing stop words).
 */
function buildStoryClusters(articles: ParsedArticle[]): StoryCluster[] {
  const clusters: StoryCluster[] = [];

  for (const article of articles) {
    const words = extractSignificantWords(article.title);
    let bestCluster: StoryCluster | null = null;
    let bestOverlap = 0;

    for (const cluster of clusters) {
      // Check overlap with any article in the cluster
      for (const existing of cluster.articles) {
        const existingWords = extractSignificantWords(existing.title);
        const overlap = countOverlap(words, existingWords);
        if (overlap >= 2 && overlap > bestOverlap) {
          bestOverlap = overlap;
          bestCluster = cluster;
        }
      }
    }

    if (bestCluster) {
      bestCluster.articles.push(article);
      bestCluster.sources.add(article.source ?? "unknown");
    } else {
      clusters.push({
        articles: [article],
        sources: new Set([article.source ?? "unknown"]),
      });
    }
  }

  return clusters;
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) {
    if (b.has(word)) {
      count++;
    }
  }
  return count;
}

function getStoryCoverageScore(
  article: ParsedArticle,
  clusters: StoryCluster[]
): number {
  for (const cluster of clusters) {
    if (cluster.articles.includes(article)) {
      const sourceCount = cluster.sources.size;
      if (sourceCount >= 4) {
        return 50;
      }
      if (sourceCount >= 3) {
        return 40;
      }
      if (sourceCount >= 2) {
        return 20;
      }
      return 0;
    }
  }
  return 0;
}

// --- Factor 4: Continues existing story (max 30) ---

function getContinuationScore(
  article: ParsedArticle,
  openStories: OpenStoryHint[]
): number {
  if (openStories.length === 0) {
    return 0;
  }

  let bestSimilarity = 0;
  for (const story of openStories) {
    const similarity = computeWordSimilarity(article.title, story.headline);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
    }
  }

  if (bestSimilarity >= 4) {
    return 30;
  }
  if (bestSimilarity >= 3) {
    return 20;
  }
  if (bestSimilarity >= 2) {
    return 10;
  }
  return 0;
}

// --- Factor 4: Breaking/urgency language (max 15) ---

const URGENCY_WORDS = [
  "crisis",
  "emergency",
  "record",
  "historic",
  "unprecedented",
  "shock",
  "surge",
  "surges",
  "plunge",
  "plunges",
  "collapse",
  "collapses",
  "crash",
  "crashes",
  "cut",
  "cuts",
  "hike",
  "hikes",
  "freeze",
  "freezes",
  "halt",
  "halts",
  "breaking",
  "urgent",
  "warns",
  "warning",
  "soars",
  "tumbles",
  "spikes",
  "slump",
  "slumps",
  "plummets",
  "skyrockets",
];

function getUrgencyScore(article: ParsedArticle): number {
  const title = article.title.toLowerCase();
  let count = 0;
  for (const word of URGENCY_WORDS) {
    if (title.includes(word)) {
      count++;
    }
  }
  if (count >= 2) {
    return 15;
  }
  if (count === 1) {
    return 8;
  }
  return 0;
}

// --- Factor 5: Recency tiebreaker (max 10) ---

function getRecencyTiebreaker(article: ParsedArticle): number {
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 24) {
    return 10;
  }
  if (ageHours <= 48) {
    return 7;
  }
  return 3;
}
