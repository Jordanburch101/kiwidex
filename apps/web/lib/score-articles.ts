/**
 * Score articles for lead selection. Runs on the web side against DB articles.
 *
 * Designed for 1-2x daily scraping where recency barely differentiates.
 * Cross-source coverage is the strongest signal — if multiple outlets
 * cover the same story, it's the day's biggest news.
 *
 * Factors (max ~125):
 * 1. Keyword tier from TITLE only (max 30)
 * 2. Headline focus — keyword density in title (max 20)
 * 3. Cross-source coverage — multiple outlets on same story (max 45)
 * 4. Breaking/urgency language in title (max 15)
 * 5. Recency — tiebreaker only (max 10)
 * 6. Has image — better lead visually (max 5)
 */

// --- Keyword tiers ---

const TIER_1 = [
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
];
const TIER_2 = [
  "interest rate",
  "inflation",
  "mortgage",
  "house price",
  "housing",
  "unemployment",
  "employment",
  "labour market",
  "property",
  "reinz",
  "cost of living",
  "exchange rate",
];
const ALL_ECONOMY_TERMS = [
  ...TIER_1,
  ...TIER_2,
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

function getTitleKeywordTierScore(title: string, excerpt: string): number {
  const titleLower = title.toLowerCase();
  for (const kw of TIER_1) {
    if (titleLower.includes(kw)) {
      return 30;
    }
  }
  for (const kw of TIER_2) {
    if (titleLower.includes(kw)) {
      return 20;
    }
  }
  for (const kw of ALL_ECONOMY_TERMS) {
    if (titleLower.includes(kw)) {
      return 10;
    }
  }
  // Fallback: check excerpt for smaller bonus
  const excerptLower = excerpt.toLowerCase();
  for (const kw of TIER_1) {
    if (excerptLower.includes(kw)) {
      return 15;
    }
  }
  for (const kw of TIER_2) {
    if (excerptLower.includes(kw)) {
      return 10;
    }
  }
  return 5;
}

// --- Headline focus (keyword density in title) ---

function getHeadlineFocusScore(title: string): number {
  const titleLower = title.toLowerCase();
  let count = 0;
  for (const term of ALL_ECONOMY_TERMS) {
    if (titleLower.includes(term)) {
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

// --- Cross-source coverage (story clustering) ---

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

function extractSignificantWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

interface StoryCluster {
  sources: Set<string>;
  titles: string[];
}

function buildStoryClusters(
  articles: { title: string; source: string }[]
): StoryCluster[] {
  const clusters: StoryCluster[] = [];

  for (const article of articles) {
    const words = extractSignificantWords(article.title);
    let bestCluster: StoryCluster | null = null;
    let bestOverlap = 0;

    for (const cluster of clusters) {
      for (const existingTitle of cluster.titles) {
        const existingWords = extractSignificantWords(existingTitle);
        let overlap = 0;
        for (const word of words) {
          if (existingWords.has(word)) {
            overlap++;
          }
        }
        if (overlap >= 2 && overlap > bestOverlap) {
          bestOverlap = overlap;
          bestCluster = cluster;
        }
      }
    }

    if (bestCluster) {
      bestCluster.titles.push(article.title);
      bestCluster.sources.add(article.source);
    } else {
      clusters.push({
        titles: [article.title],
        sources: new Set([article.source]),
      });
    }
  }

  return clusters;
}

function getStoryCoverageScore(
  title: string,
  clusters: StoryCluster[]
): number {
  for (const cluster of clusters) {
    if (cluster.titles.includes(title)) {
      const sourceCount = cluster.sources.size;
      if (sourceCount >= 4) {
        return 45;
      }
      if (sourceCount >= 3) {
        return 30;
      }
      if (sourceCount >= 2) {
        return 15;
      }
      return 0;
    }
  }
  return 0;
}

// --- Breaking/urgency language ---

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

function getUrgencyScore(title: string): number {
  const titleLower = title.toLowerCase();
  let count = 0;
  for (const word of URGENCY_WORDS) {
    if (titleLower.includes(word)) {
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

// --- Recency tiebreaker ---

function getRecencyTiebreaker(publishedAt: string): number {
  const ageHours =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours <= 24) {
    return 10;
  }
  if (ageHours <= 48) {
    return 7;
  }
  return 3;
}

// --- Main export ---

export function pickLeadAndRest<
  T extends {
    title: string;
    excerpt: string;
    publishedAt: string;
    source: string;
    imageUrl: string | null;
  },
>(articles: T[]): { lead: T; rest: T[] } | null {
  if (articles.length === 0) {
    return null;
  }

  const clusters = buildStoryClusters(
    articles.map((a) => ({ title: a.title, source: a.source }))
  );

  const scored = articles.map((article) => ({
    article,
    score:
      getTitleKeywordTierScore(article.title, article.excerpt) +
      getHeadlineFocusScore(article.title) +
      getStoryCoverageScore(article.title, clusters) +
      getUrgencyScore(article.title) +
      getRecencyTiebreaker(article.publishedAt) +
      (article.imageUrl ? 5 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);

  const lead = scored[0]!.article;
  const rest = scored.slice(1).map((s) => s.article);

  return { lead, rest };
}
