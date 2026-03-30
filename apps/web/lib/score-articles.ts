/**
 * Score articles for display ordering. The highest-scored article becomes the lead.
 * This mirrors the ingestion scoring logic but runs on the web side
 * against the articles already in the DB.
 */

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

function getKeywordTierScore(title: string, excerpt: string): number {
  const text = `${title} ${excerpt}`.toLowerCase();
  for (const kw of TIER_1) {
    if (text.includes(kw)) {
      return 30;
    }
  }
  for (const kw of TIER_2) {
    if (text.includes(kw)) {
      return 20;
    }
  }
  return 10;
}

function getRecencyScore(publishedAt: string): number {
  const ageHours =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  if (ageHours <= 6) {
    return 25;
  }
  if (ageHours <= 12) {
    return 20;
  }
  if (ageHours <= 24) {
    return 15;
  }
  if (ageHours <= 48) {
    return 10;
  }
  return 5;
}

function getCoverageScore(
  title: string,
  allArticles: { title: string; source: string }[]
): number {
  const TOPIC_TERMS = [
    "ocr",
    "rbnz",
    "reserve bank",
    "gdp",
    "cpi",
    "recession",
    "interest rate",
    "inflation",
    "mortgage",
    "house price",
    "housing",
    "unemployment",
    "petrol",
    "fuel",
    "grocery",
    "exchange rate",
    "budget",
    "fiscal",
    "trade",
    "employment",
  ];
  const text = title.toLowerCase();
  const myTerms = TOPIC_TERMS.filter((t) => text.includes(t));
  if (myTerms.length === 0) {
    return 0;
  }

  const sourcesOnSameTopic = new Set<string>();
  for (const article of allArticles) {
    const otherText = article.title.toLowerCase();
    if (myTerms.some((t) => otherText.includes(t))) {
      sourcesOnSameTopic.add(article.source);
    }
  }
  return (sourcesOnSameTopic.size - 1) * 15;
}

export function pickLeadAndRest<
  T extends {
    title: string;
    excerpt: string;
    publishedAt: string;
    source: string;
  },
>(articles: T[]): { lead: T; rest: T[] } | null {
  if (articles.length === 0) {
    return null;
  }

  const scored = articles.map((article) => ({
    article,
    score:
      getKeywordTierScore(article.title, article.excerpt) +
      getRecencyScore(article.publishedAt) +
      getCoverageScore(
        article.title,
        articles.map((a) => ({ title: a.title, source: a.source }))
      ),
  }));

  scored.sort((a, b) => b.score - a.score);

  const lead = scored[0]!.article;
  const rest = scored.slice(1).map((s) => s.article);

  return { lead, rest };
}
