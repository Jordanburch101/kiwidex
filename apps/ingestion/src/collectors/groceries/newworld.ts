import type { BasketItem } from "./basket";
import { NEWWORLD_API_CONFIG, scrapeFoodstuffsApi } from "./foodstuffs-api";
import type { ScrapedProduct } from "./types";

/**
 * Scrape all matching products from New World for the given basket items.
 *
 * Uses the direct Foodstuffs API (Algolia search + decorateProducts)
 * instead of Playwright browser scraping to avoid Cloudflare blocking.
 */
export async function scrapeNewWorld(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  return scrapeFoodstuffsApi(NEWWORLD_API_CONFIG, basket);
}
