import type { GroceryProduct, ScrapedPrice } from "./types";

const PRODUCTS: GroceryProduct[] = [
  {
    query: "anchor blue top milk 2l",
    metric: "milk",
    expectedSize: "2l",
  },
  {
    query: "free range eggs 12 pack",
    metric: "eggs",
    expectedSize: "12",
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

/**
 * Extract product data from Pak'nSave search results.
 *
 * Pak'nSave uses Next.js with data-testid attributes:
 * - Product card: `div[data-testid^="product-"][data-testid*="-EA-"]`
 * - Product title: `[data-testid="product-title"]`
 * - Product subtitle (size): `[data-testid="product-subtitle"]`
 * - Price dollars: `[data-testid="price-dollars"]`
 * - Price cents: `[data-testid="price-cents"]`
 */
function extractProducts(): { name: string; price: number }[] {
  const items: { name: string; price: number }[] = [];

  // Strategy 1: data-testid based product cards
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
        Number.parseInt(dollarsEl.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      const cents =
        Number.parseInt(centsEl?.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      if (dollars > 0 && name) {
        items.push({ name, price: dollars + cents / 100 });
      }
    }
  }

  // Strategy 2: broader fallback using price pattern in text
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
          Number.parseInt(match[1]!, 10) + Number.parseInt(match[2]!, 10) / 100;
        items.push({ name, price });
      }
    }
  }

  return items;
}

/**
 * Scrape grocery prices from Pak'nSave using Chromium + stealth plugin.
 *
 * Strategy:
 * 1. Visit homepage to establish session and store selection
 * 2. Search for each product individually
 * 3. Extract prices from rendered Next.js components via page.evaluate
 * 4. Pick the best matching product based on expectedSize
 */
export async function scrapePakNSave(): Promise<ScrapedPrice[]> {
  console.log("[paknsave] Starting scrape...");

  // Dynamic imports for stealth plugin compatibility with Bun
  const { chromium } = await import("playwright-extra");
  const stealthModule = await import("puppeteer-extra-plugin-stealth");
  const stealthFn =
    typeof stealthModule.default === "function"
      ? stealthModule.default
      : (stealthModule as unknown as { default: () => unknown }).default;
  // biome-ignore lint/suspicious/noExplicitAny: stealth plugin types don't align with playwright-extra's CompatiblePlugin
  chromium.use(stealthFn() as any);

  const browser = await chromium.launch({ headless: true });
  const results: ScrapedPrice[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      geolocation: { latitude: -36.8485, longitude: 174.7633 },
      permissions: ["geolocation"],
    });
    const page = await context.newPage();

    // Block images/fonts/trackers/challenge platform for speed
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
        url.includes("doubleclick.net") ||
        url.includes("challenges.cloudflare.com")
      ) {
        return route.abort();
      }
      return route.continue();
    });

    // Visit homepage first to trigger store selection / set cookies
    console.log("[paknsave] Loading homepage...");
    try {
      await page.goto("https://www.paknsave.co.nz", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await delay(3000);
    } catch (e) {
      console.warn(
        `[paknsave] Homepage load issue: ${e instanceof Error ? e.message : e}`
      );
    }

    for (const product of PRODUCTS) {
      try {
        const searchUrl = `https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(product.query)}`;
        console.log(`[paknsave] Searching: ${product.query}`);

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
            `[paknsave] Timeout waiting for products for: ${product.query}`
          );
        }

        // Scroll to trigger lazy loads
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await delay(120);
        }

        // Extract products from the page
        const parsed = await page.evaluate(extractProducts);

        if (parsed.length > 0) {
          // Pick the best match: prefer product whose name contains expectedSize
          let best = parsed[0]!;
          if (product.expectedSize) {
            const sizeMatch = parsed.find((p) =>
              p.name.toLowerCase().includes(product.expectedSize!.toLowerCase())
            );
            if (sizeMatch) {
              best = sizeMatch;
            } else {
              console.warn(
                `[paknsave] No exact size match for "${product.expectedSize}", using top result`
              );
            }
          }

          if (best.price >= 0.5 && best.price <= 100) {
            results.push({
              metric: product.metric,
              price: best.price,
              productName: best.name,
              source: "paknsave.co.nz",
            });
            console.log(
              `[paknsave] ${product.metric}: $${best.price} (${best.name})`
            );
          } else {
            console.warn(
              `[paknsave] Rejected ${product.metric}: $${best.price} (out of range)`
            );
          }
        } else {
          console.warn(`[paknsave] No products found for: ${product.query}`);
          const bodyText = await page.evaluate(
            () => document.body?.innerText?.substring(0, 500) || ""
          );
          console.warn(`[paknsave] Page text preview: ${bodyText}`);
        }

        // Longer delay between pages for Pak'nSave
        await delay(11_000);
      } catch (e) {
        console.error(
          `[paknsave] Error scraping ${product.metric}: ${e instanceof Error ? e.message : e}`
        );
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(
    `[paknsave] Completed: ${results.length}/${PRODUCTS.length} prices scraped`
  );
  return results;
}
