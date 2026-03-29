import type { BasketItem } from "./basket";
import { extractBrand } from "./brands";
import type { ScrapedProduct } from "./types";

/**
 * Configuration for a Foodstuffs-platform store (Pak'nSave or New World).
 */
export interface FoodstuffsConfig {
  storeName: string;
  storeKey: "paknsave" | "newworld";
  domain: string;
  searchUrl: (query: string) => string;
  geolocation: { latitude: number; longitude: number };
  delayBetweenSearches: number;
}

export const PAKNSAVE_CONFIG: FoodstuffsConfig = {
  storeName: "paknsave.co.nz",
  storeKey: "paknsave",
  domain: "https://www.paknsave.co.nz",
  searchUrl: (q) =>
    `https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(q)}`,
  geolocation: { latitude: -36.8485, longitude: 174.7633 },
  delayBetweenSearches: 11_000,
};

export const NEWWORLD_CONFIG: FoodstuffsConfig = {
  storeName: "newworld.co.nz",
  storeKey: "newworld",
  domain: "https://www.newworld.co.nz",
  searchUrl: (q) =>
    `https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(q)}`,
  geolocation: { latitude: -36.8485, longitude: 174.7633 },
  delayBetweenSearches: 11_000,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract product data from a Foodstuffs (Pak'nSave / New World) search results page.
 *
 * Both stores use the same Next.js platform with data-testid attributes:
 * - Product card: `div[data-testid*="-EA-"]`
 * - Product title: `[data-testid="product-title"]`
 * - Product subtitle (size): `[data-testid="product-subtitle"]`
 * - Price dollars: `[data-testid="price-dollars"]`
 * - Price cents: `[data-testid="price-cents"]`
 */
function extractProductsFromPage(): {
  name: string;
  price: number;
  subtitle: string;
}[] {
  const items: { name: string; price: number; subtitle: string }[] = [];

  const cards = document.querySelectorAll('div[data-testid*="-EA-"]');
  for (const card of cards) {
    const titleEl = card.querySelector('[data-testid="product-title"]');
    const subtitleEl = card.querySelector('[data-testid="product-subtitle"]');
    const dollarsEl = card.querySelector('[data-testid="price-dollars"]');
    const centsEl = card.querySelector('[data-testid="price-cents"]');

    if (titleEl && dollarsEl) {
      const title = titleEl.textContent?.trim() || "";
      const subtitle = subtitleEl?.textContent?.trim() || "";
      const name = subtitle ? `${title} ${subtitle}` : title;
      const dollars =
        Number.parseInt(
          dollarsEl.textContent?.replace(/\D/g, "") || "0",
          10
        ) || 0;
      const cents =
        Number.parseInt(
          centsEl?.textContent?.replace(/\D/g, "") || "0",
          10
        ) || 0;
      if (dollars > 0 && name) {
        items.push({ name, price: dollars + cents / 100, subtitle });
      }
    }
  }

  // Fallback: broader text-based price extraction
  if (items.length === 0) {
    const allCards = document.querySelectorAll(
      '[class*="product"], [class*="search-result"]'
    );
    for (const card of allCards) {
      const name = card.querySelector("h3, p")?.textContent?.trim() || "";
      const priceText = card.textContent || "";
      const match = priceText.match(/\$\s*(\d+)[.\s]*(\d{2})/);
      if (name && match) {
        const price =
          Number.parseInt(match[1]!, 10) +
          Number.parseInt(match[2]!, 10) / 100;
        items.push({ name, price, subtitle: "" });
      }
    }
  }

  return items;
}

// Register stealth plugin once at module scope
let stealthRegistered = false;

/**
 * Scrape all matching products for the given basket items from a Foodstuffs store.
 */
export async function scrapeFoodstuffs(
  config: FoodstuffsConfig,
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  const tag = `[${config.storeKey}]`;
  console.log(`${tag} Starting scrape...`);

  const { chromium } = await import("playwright-extra");

  if (!stealthRegistered) {
    const stealthModule = await import("puppeteer-extra-plugin-stealth");
    const stealthFn =
      typeof stealthModule.default === "function"
        ? stealthModule.default
        : (stealthModule as unknown as { default: () => unknown }).default;
    // biome-ignore lint/suspicious/noExplicitAny: stealth plugin types don't align with playwright-extra's CompatiblePlugin
    chromium.use(stealthFn() as any);
    stealthRegistered = true;
  }

  const browser = await chromium.launch({ headless: true });
  const allProducts: ScrapedProduct[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      geolocation: config.geolocation,
      permissions: ["geolocation"],
    });
    const page = await context.newPage();

    // Block images/fonts/trackers for speed (but NOT challenges.cloudflare.com)
    await page.route("**/*", (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();
      if (
        resourceType === "image" ||
        resourceType === "font" ||
        resourceType === "media"
      ) {
        return route.abort();
      }
      if (
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.net") ||
        url.includes("doubleclick.net")
      ) {
        return route.abort();
      }
      return route.continue();
    });

    // Visit homepage to establish session and store selection
    console.log(`${tag} Loading homepage...`);
    try {
      await page.goto(config.domain, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await delay(3000);

      // Verify store selection loaded (look for store name or address indicator)
      const hasStoreIndicator = await page
        .locator('[data-testid="store-name"], [class*="store-selector"]')
        .count();
      if (hasStoreIndicator === 0) {
        console.warn(
          `${tag} No store selection indicator found, results may vary by region`
        );
      }
    } catch (e) {
      console.warn(
        `${tag} Homepage load issue: ${e instanceof Error ? e.message : e}`
      );
    }

    for (const item of basket) {
      try {
        const query = item.searchQueries[config.storeKey];
        const searchUrl = config.searchUrl(query);
        console.log(`${tag} Searching: ${query} (${item.category})`);

        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        // Wait for product cards to appear
        try {
          await page.waitForSelector(
            '[data-testid="price-dollars"], div[data-testid*="-EA-"]',
            { timeout: 15_000 }
          );
        } catch {
          console.warn(
            `${tag} Timeout waiting for products for: ${query}`
          );
        }

        // Scroll to trigger lazy loads
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await delay(120);
        }

        // Extract products from the page
        const parsed = await page.evaluate(extractProductsFromPage);

        let matched = 0;
        for (const p of parsed) {
          const fullName = p.name;

          // Strict size validation: reject products that don't match size patterns
          const sizeMatch = item.sizePatterns.some((re) => re.test(fullName));
          if (!sizeMatch) {
            continue;
          }

          // Per-product price range validation
          if (p.price < item.priceRange.min || p.price > item.priceRange.max) {
            console.warn(
              `${tag} Rejected ${item.category} product "$${p.price}" (${fullName}) - out of range [${item.priceRange.min}-${item.priceRange.max}]`
            );
            continue;
          }

          // Generate a stable product ID from the name
          const productId = fullName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          allProducts.push({
            productId,
            store: config.storeName,
            category: item.category,
            name: fullName,
            brand: extractBrand(fullName),
            size: item.standardUnit,
            price: p.price,
            unitPrice: undefined,
            source: config.searchUrl(query),
          });
          matched++;
        }

        if (matched === 0) {
          console.warn(
            `${tag} No valid products matched for ${item.category} (${parsed.length} candidates, none passed size/price filters)`
          );
        } else {
          console.log(
            `${tag} ${item.category}: ${matched} products matched`
          );
        }

        // Delay between searches (skip after last item)
        if (basket.indexOf(item) < basket.length - 1) {
          await delay(config.delayBetweenSearches);
        }
      } catch (e) {
        console.error(
          `${tag} Error scraping ${item.category}: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(
    `${tag} Completed: ${allProducts.length} total products scraped`
  );
  return allProducts;
}
