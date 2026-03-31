import type { BasketItem } from "./basket";
import { PAKNSAVE_CONFIG, scrapeFoodstuffs } from "./foodstuffs-scraper";
import type { ScrapedProduct } from "./types";

/**
 * Scrape all matching products from Pak'nSave for the given basket items.
 *
 * Uses the shared Foodstuffs platform scraper since Pak'nSave and New World
 * share the same Next.js platform with identical data-testid selectors.
 */
export async function scrapePakNSave(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  return scrapeFoodstuffs(PAKNSAVE_CONFIG, basket);
}
