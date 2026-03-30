/**
 * Economy keyword allowlist — derived from the dashboard's metric domains.
 * An article passes if headline OR excerpt contains at least one keyword (case-insensitive).
 */
const ECONOMY_KEYWORDS = [
  // Rates / monetary
  "ocr",
  "interest rate",
  "cash rate",
  "rbnz",
  "reserve bank",
  "monetary policy",
  // Inflation / prices
  "inflation",
  "cpi",
  "cost of living",
  "price",
  // Housing
  "housing",
  "house price",
  "mortgage",
  "property",
  "rent",
  "reinz",
  // Fuel
  "petrol",
  "fuel",
  "diesel",
  "gas price",
  // Groceries
  "grocery",
  "supermarket",
  "food price",
  "woolworths",
  "pak'nsave",
  "foodstuffs",
  // Labour
  "unemployment",
  "job",
  "wage",
  "salary",
  "income",
  "employment",
  "labour market",
  // Currency / trade
  "nzd",
  "dollar",
  "exchange rate",
  "currency",
  "trade",
  // Macro
  "gdp",
  "economy",
  "recession",
  "growth",
  "budget",
  "fiscal",
];

export function matchesEconomyKeywords(
  title: string,
  excerpt: string
): boolean {
  const text = `${title} ${excerpt}`.toLowerCase();
  return ECONOMY_KEYWORDS.some((keyword) => text.includes(keyword));
}
