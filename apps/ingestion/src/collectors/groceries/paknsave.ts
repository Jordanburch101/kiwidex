import type { BasketItem } from "./basket";
import { PAKNSAVE_API_CONFIG, scrapeFoodstuffsApi } from "./foodstuffs-api";
import type { ScrapedProduct } from "./types";

/**
 * Scrape all matching products from Pak'nSave for the given basket items.
 *
 * Uses the direct Foodstuffs API (Algolia search + decorateProducts)
 * instead of Playwright browser scraping to avoid Cloudflare blocking.
 */
export async function scrapePakNSave(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  return scrapeFoodstuffsApi(PAKNSAVE_API_CONFIG, basket);
}
