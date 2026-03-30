import type { ParsedArticle } from "./parse-rss";
import { getKeywordTier } from "./keywords";

export interface ScoredArticle extends ParsedArticle {
  score: number;
}

/**
 * Score articles by importance. Higher score = more important.
 *
 * Factors:
 * 1. Keyword tier: tier 1 = +30, tier 2 = +20, tier 3 = +10
 * 2. Recency: up to +25 points for articles from the last 6 hours, decaying over 48 hours
 * 3. Cross-source coverage: +15 per additional source covering the same topic
 */
export function scoreArticles(articles: ParsedArticle[]): ScoredArticle[] {
  const topicCounts = buildTopicCounts(articles);

  return articles.map((article) => {
    const tierScore = getKeywordTierScore(article);
    const recencyScore = getRecencyScore(article);
    const coverageScore = getCoverageScore(article, topicCounts);

    return {
      ...article,
      score: tierScore + recencyScore + coverageScore,
    };
  });
}

function getKeywordTierScore(article: ParsedArticle): number {
  const tier = getKeywordTier(article.title, article.excerpt);
  if (tier === 1) return 30;
  if (tier === 2) return 20;
  if (tier === 3) return 10;
  return 0;
}

function getRecencyScore(article: ParsedArticle): number {
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 6) return 25;
  if (ageHours <= 12) return 20;
  if (ageHours <= 24) return 15;
  if (ageHours <= 48) return 10;
  return 5;
}

/**
 * Detect cross-source coverage by extracting key terms from titles
 * and checking if multiple sources share them.
 */
function buildTopicCounts(
  articles: ParsedArticle[]
): Map<string, Set<string>> {
  const topicSources = new Map<string, Set<string>>();

  for (const article of articles) {
    const terms = extractTopicTerms(article.title);
    for (const term of terms) {
      if (!topicSources.has(term)) {
        topicSources.set(term, new Set());
      }
      topicSources.get(term)!.add(article.source ?? "unknown");
    }
  }

  return topicSources;
}

function getCoverageScore(
  article: ParsedArticle,
  topicCounts: Map<string, Set<string>>
): number {
  const terms = extractTopicTerms(article.title);
  let maxSources = 1;

  for (const term of terms) {
    const sources = topicCounts.get(term);
    if (sources && sources.size > maxSources) {
      maxSources = sources.size;
    }
  }

  // +15 per additional source beyond the first
  return (maxSources - 1) * 15;
}

/**
 * Extract significant topic terms from a title for cross-source matching.
 * Uses the economy keywords as the vocabulary.
 */
function extractTopicTerms(title: string): string[] {
  const text = title.toLowerCase();
  const TOPIC_TERMS = [
    "ocr", "rbnz", "reserve bank", "gdp", "cpi", "recession",
    "interest rate", "inflation", "mortgage", "house price", "housing",
    "unemployment", "petrol", "fuel", "grocery", "exchange rate",
    "budget", "fiscal", "trade", "employment",
  ];
  return TOPIC_TERMS.filter((term) => text.includes(term));
}
