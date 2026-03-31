import type { BasketItem } from "./basket";
import { NEWWORLD_CONFIG, scrapeFoodstuffs } from "./foodstuffs-scraper";
import type { ScrapedProduct } from "./types";

/**
 * Scrape all matching products from New World for the given basket items.
 *
 * Uses the shared Foodstuffs platform scraper since New World and Pak'nSave
 * share the same Next.js platform with identical data-testid selectors.
 */
export async function scrapeNewWorld(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  return scrapeFoodstuffs(NEWWORLD_CONFIG, basket);
}
