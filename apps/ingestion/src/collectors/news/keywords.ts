/**
 * Economy keywords with importance tiers.
 * Tier 1 = macro/policy (high impact, affects everyone)
 * Tier 2 = sector-level (important, more specific)
 * Tier 3 = everyday economy (general, less "breaking")
 */

interface WeightedKeyword {
  keyword: string;
  tier: 1 | 2 | 3;
}

const WEIGHTED_KEYWORDS: WeightedKeyword[] = [
  // Tier 1 — macro/policy
  { keyword: "ocr", tier: 1 },
  { keyword: "rbnz", tier: 1 },
  { keyword: "reserve bank", tier: 1 },
  { keyword: "monetary policy", tier: 1 },
  { keyword: "gdp", tier: 1 },
  { keyword: "cpi", tier: 1 },
  { keyword: "recession", tier: 1 },
  { keyword: "cash rate", tier: 1 },
  { keyword: "fiscal", tier: 1 },
  { keyword: "budget", tier: 1 },
  // Tier 2 — sector-level
  { keyword: "interest rate", tier: 2 },
  { keyword: "inflation", tier: 2 },
  { keyword: "mortgage", tier: 2 },
  { keyword: "house price", tier: 2 },
  { keyword: "housing", tier: 2 },
  { keyword: "unemployment", tier: 2 },
  { keyword: "employment", tier: 2 },
  { keyword: "labour market", tier: 2 },
  { keyword: "property market", tier: 2 },
  { keyword: "property price", tier: 2 },
  { keyword: "property value", tier: 2 },
  { keyword: "reinz", tier: 2 },
  { keyword: "cost of living", tier: 2 },
  { keyword: "exchange rate", tier: 2 },
  // Tier 3 — everyday
  { keyword: "petrol", tier: 3 },
  { keyword: "fuel", tier: 3 },
  { keyword: "diesel", tier: 3 },
  { keyword: "gas price", tier: 3 },
  { keyword: "grocery", tier: 3 },
  { keyword: "supermarket", tier: 3 },
  { keyword: "food price", tier: 3 },
  { keyword: "woolworths", tier: 3 },
  { keyword: "pak'nsave", tier: 3 },
  { keyword: "foodstuffs", tier: 3 },
  { keyword: "wage", tier: 3 },
  { keyword: "salary", tier: 3 },
  { keyword: "income", tier: 3 },
  { keyword: "job", tier: 3 },
  { keyword: "nzd", tier: 3 },
  { keyword: "dollar", tier: 3 },
  { keyword: "currency", tier: 3 },
  { keyword: "trade", tier: 3 },
  { keyword: "economy", tier: 3 },
  { keyword: "growth", tier: 3 },
  { keyword: "price", tier: 3 },
  { keyword: "rent", tier: 3 },
];

/** Pre-compiled word-boundary regexes for each keyword */
const KEYWORD_REGEXES = new Map<string, RegExp>(
  WEIGHTED_KEYWORDS.map((wk) => [
    wk.keyword,
    new RegExp(`\\b${wk.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
  ])
);

function matchKeyword(text: string, keyword: string): boolean {
  return KEYWORD_REGEXES.get(keyword)?.test(text) ?? false;
}

/**
 * Check if article matches economy keywords.
 * Uses word-boundary matching to prevent false positives
 * (e.g. "rural property" matching the "property" real-estate keyword).
 * For firehose sources (like 1News), use strict mode which requires
 * a tier 1/2 keyword OR at least 2 tier 3 keywords.
 * This prevents generic words like "job", "price", "growth" from
 * matching crime/sport/lifestyle articles.
 */
export function matchesEconomyKeywords(
  title: string,
  excerpt: string,
  strict = false
): boolean {
  const text = `${title} ${excerpt}`.toLowerCase();

  if (!strict) {
    return WEIGHTED_KEYWORDS.some((wk) => matchKeyword(text, wk.keyword));
  }

  // Strict mode: require tier 1/2 match, or 2+ tier 3 matches
  let tier3Count = 0;
  for (const wk of WEIGHTED_KEYWORDS) {
    if (matchKeyword(text, wk.keyword)) {
      if (wk.tier <= 2) {
        return true;
      }
      tier3Count++;
      if (tier3Count >= 2) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Return the highest tier matched (1 = most important, 3 = least).
 * Returns 0 if no keywords match.
 */
export function getKeywordTier(title: string, excerpt: string): number {
  const text = `${title} ${excerpt}`.toLowerCase();
  let bestTier = 0;
  for (const wk of WEIGHTED_KEYWORDS) {
    if (matchKeyword(text, wk.keyword)) {
      if (bestTier === 0 || wk.tier < bestTier) {
        bestTier = wk.tier;
      }
      if (bestTier === 1) {
        break; // Can't do better than tier 1
      }
    }
  }
  return bestTier;
}
