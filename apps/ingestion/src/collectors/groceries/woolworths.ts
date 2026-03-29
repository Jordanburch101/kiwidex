import { firefox } from "playwright";
import type { BasketItem } from "./basket";
import { extractBrand } from "./brands";
import type { ScrapedProduct } from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

/**
 * Extract product name and price from Woolworths search results using page.evaluate.
 *
 * Woolworths NZ uses Angular with custom elements:
 * - Product card: `cdx-card`
 * - Product name: `h3[id*="-title"]`
 * - Price dollars: `product-price h3 em`
 * - Price cents: `product-price h3 span`
 */
function extractProducts(): { name: string; price: number }[] {
  const items: { name: string; price: number }[] = [];
  const cards = document.querySelectorAll("cdx-card");

  for (const card of cards) {
    const titleEl = card.querySelector('h3[id*="-title"]');
    const name = titleEl?.textContent?.trim() || "";
    if (!name) {
      continue;
    }

    const dollarEl = card.querySelector("product-price h3 em");
    const centEl = card.querySelector("product-price h3 span");

    if (dollarEl) {
      const dollars =
        Number.parseInt(dollarEl.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      const cents =
        Number.parseInt(centEl?.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      if (dollars > 0) {
        items.push({ name, price: dollars + cents / 100 });
      }
    }
  }

  // Fallback: broader text-based price extraction
  if (items.length === 0) {
    const allCards = document.querySelectorAll(
      ".product-entry, [class*='product-card']"
    );
    for (const card of allCards) {
      const name = card.querySelector("h3")?.textContent?.trim() || "";
      if (!name) {
        continue;
      }
      const text = card.textContent || "";
      const match = text.match(/\$\s*(\d+)\s*(\d{2})/);
      if (match) {
        const price =
          Number.parseInt(match[1]!, 10) +
          Number.parseInt(match[2]!, 10) / 100;
        items.push({ name, price });
      }
    }
  }

  return items;
}

/**
 * Scrape ALL matching products from Woolworths NZ for the given basket items.
 *
 * Strategy:
 * 1. Visit homepage to establish session cookies
 * 2. Navigate to search results for each basket item
 * 3. Extract ALL products that pass size and price validation
 *
 * Search URL pattern: /shop/searchproducts?search={query}
 */
export async function scrapeWoolworths(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  console.log("[woolworths] Starting scrape...");
  const browser = await firefox.launch({ headless: true });
  const allProducts: ScrapedProduct[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        "x-requested-with": "OnlineShopping.WebApp",
      },
    });
    const page = await context.newPage();

    // Block images/fonts/trackers for speed
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

    // Visit homepage first to establish session cookies
    console.log("[woolworths] Loading homepage for session...");
    await page.goto("https://www.woolworths.co.nz", {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await delay(2000);

    for (const item of basket) {
      try {
        const query = item.searchQueries.woolworths;
        const searchUrl = `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(query)}`;
        console.log(`[woolworths] Searching: ${query} (${item.category})`);

        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        // Wait for product cards to render
        try {
          await page.waitForSelector("cdx-card", { timeout: 15_000 });
        } catch {
          console.warn(
            `[woolworths] Timeout waiting for products for: ${query}`
          );
        }

        // Scroll down to trigger lazy loads
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await randomDelay(500, 1500);
        }

        // Extract product data from the rendered page
        const parsed = await page.evaluate(extractProducts);

        let matched = 0;
        for (const p of parsed) {
          // Strict size validation
          const sizeMatch = item.sizePatterns.some((re) => re.test(p.name));
          if (!sizeMatch) {
            continue;
          }

          // Exclude specialty/flavoured products
          if (item.excludePatterns.some((re) => re.test(p.name))) {
            continue;
          }

          // Include patterns: if defined, product must match at least one
          if (item.includePatterns && !item.includePatterns.some((re) => re.test(p.name))) {
            continue;
          }

          // Per-product price range validation
          if (p.price < item.priceRange.min || p.price > item.priceRange.max) {
            console.warn(
              `[woolworths] Rejected ${item.category} product "$${p.price}" (${p.name}) - out of range [${item.priceRange.min}-${item.priceRange.max}]`
            );
            continue;
          }

          // Generate a stable product ID from the name
          const productId = p.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          allProducts.push({
            productId,
            store: "woolworths.co.nz",
            category: item.category,
            name: p.name,
            brand: extractBrand(p.name),
            size: item.standardUnit,
            price: p.price,
            unitPrice: undefined,
            source: searchUrl,
          });
          matched++;
        }

        if (matched === 0) {
          console.warn(
            `[woolworths] No valid products matched for ${item.category} (${parsed.length} candidates, none passed size/price filters)`
          );
          if (parsed.length === 0) {
            const bodyText = await page.evaluate(
              () => document.body?.innerText?.substring(0, 500) || ""
            );
            console.warn(`[woolworths] Page text preview: ${bodyText}`);
          }
        } else {
          console.log(
            `[woolworths] ${item.category}: ${matched} products matched`
          );
        }

        // Delay between pages (skip after last item)
        if (basket.indexOf(item) < basket.length - 1) {
          await delay(7000);
        }
      } catch (e) {
        console.error(
          `[woolworths] Error scraping ${item.category}: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(
    `[woolworths] Completed: ${allProducts.length} total products scraped`
  );
  return allProducts;
}
