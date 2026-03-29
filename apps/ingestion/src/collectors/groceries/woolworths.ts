import { firefox } from "playwright";
import type { GroceryProduct, ScrapedPrice } from "./types";

const PRODUCTS: GroceryProduct[] = [
  {
    query: "anchor milk standard blue 2l",
    metric: "milk",
    expectedSize: "2l",
  },
  {
    query: "free range eggs 12 pack",
    metric: "eggs",
    expectedSize: "12pack",
  },
  { query: "tip top toast white", metric: "bread" },
  { query: "anchor butter 500g", metric: "butter", expectedSize: "500g" },
  {
    query: "mainland mild cheese 1kg",
    metric: "cheese",
    expectedSize: "1kg",
  },
];

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
    // Extract name from the title h3
    const titleEl = card.querySelector('h3[id*="-title"]');
    const name = titleEl?.textContent?.trim() || "";
    if (!name) {
      continue;
    }

    // Extract price: dollars from <em>, cents from <span> inside product-price h3
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
          Number.parseInt(match[1]!, 10) + Number.parseInt(match[2]!, 10) / 100;
        items.push({ name, price });
      }
    }
  }

  return items;
}

/**
 * Scrape grocery prices from Woolworths NZ using Firefox.
 *
 * Strategy:
 * 1. Visit homepage to establish session cookies
 * 2. Navigate to search results for each product
 * 3. Extract prices from rendered Angular components via page.evaluate
 *
 * Search URL pattern: /shop/searchproducts?search={query}
 * (Note: the old /shop/search?q= pattern no longer works)
 */
export async function scrapeWoolworths(): Promise<ScrapedPrice[]> {
  console.log("[woolworths] Starting scrape...");
  const browser = await firefox.launch({ headless: true });
  const results: ScrapedPrice[] = [];

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

    for (const product of PRODUCTS) {
      try {
        const searchUrl = `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(product.query)}`;
        console.log(`[woolworths] Searching: ${product.query}`);

        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        // Wait for product cards to render
        try {
          await page.waitForSelector("cdx-card", { timeout: 15_000 });
        } catch {
          console.warn(
            `[woolworths] Timeout waiting for products for: ${product.query}`
          );
        }

        // Scroll down to trigger lazy loads
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await randomDelay(500, 1500);
        }

        // Extract product data from the rendered page
        const parsed = await page.evaluate(extractProducts);

        if (parsed.length > 0) {
          // Pick the best match: prefer a product whose name contains expectedSize
          let best = parsed[0]!;
          if (product.expectedSize) {
            const sizeMatch = parsed.find((p) =>
              p.name.toLowerCase().includes(product.expectedSize!.toLowerCase())
            );
            if (sizeMatch) {
              best = sizeMatch;
            } else {
              console.warn(
                `[woolworths] No exact size match for "${product.expectedSize}", using top result`
              );
            }
          }

          // Validate price is reasonable
          if (best.price >= 0.5 && best.price <= 100) {
            results.push({
              metric: product.metric,
              price: best.price,
              productName: best.name,
              source: "woolworths.co.nz",
            });
            console.log(
              `[woolworths] ${product.metric}: $${best.price} (${best.name})`
            );
          } else {
            console.warn(
              `[woolworths] Rejected ${product.metric}: $${best.price} (out of range)`
            );
          }
        } else {
          console.warn(`[woolworths] No products found for: ${product.query}`);
          const bodyText = await page.evaluate(
            () => document.body?.innerText?.substring(0, 500) || ""
          );
          console.warn(`[woolworths] Page text preview: ${bodyText}`);
        }

        // Delay between pages
        await delay(7000);
      } catch (e) {
        console.error(
          `[woolworths] Error scraping ${product.metric}: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(
    `[woolworths] Completed: ${results.length}/${PRODUCTS.length} prices scraped`
  );
  return results;
}
