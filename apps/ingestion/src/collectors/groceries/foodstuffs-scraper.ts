import type { BasketItem } from "./basket";
import { extractBrand } from "./brands";
import type { ScrapedProduct } from "./types";

export interface FoodstuffsConfig {
  delayBetweenSearches: number;
  domain: string;
  geolocation: { latitude: number; longitude: number };
  searchUrl: (query: string) => string;
  storeKey: "paknsave" | "newworld";
  storeName: string;
}

export const PAKNSAVE_CONFIG: FoodstuffsConfig = {
  storeName: "paknsave.co.nz",
  storeKey: "paknsave",
  domain: "https://www.paknsave.co.nz",
  searchUrl: (q) =>
    `https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(q)}`,
  geolocation: { latitude: -36.8485, longitude: 174.7633 },
  delayBetweenSearches: 12_000,
};

export const NEWWORLD_CONFIG: FoodstuffsConfig = {
  storeName: "newworld.co.nz",
  storeKey: "newworld",
  domain: "https://www.newworld.co.nz",
  searchUrl: (q) =>
    `https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(q)}`,
  geolocation: { latitude: -36.8485, longitude: 174.7633 },
  delayBetweenSearches: 12_000,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

/**
 * Extract product data from a Foodstuffs search results page via page.evaluate.
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
        Number.parseInt(dollarsEl.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      const cents =
        Number.parseInt(centsEl?.textContent?.replace(/\D/g, "") || "0", 10) ||
        0;
      if (dollars > 0 && name) {
        items.push({ name, price: dollars + cents / 100, subtitle });
      }
    }
  }

  return items;
}

// Register stealth plugin once at module scope
let stealthRegistered = false;

const MAX_RETRIES = 2;

/**
 * Navigate to a URL with retry logic and Cloudflare challenge handling.
 * Returns true if the page loaded successfully with product results.
 */
async function navigateWithRetry(
  page: import("playwright").Page,
  url: string,
  tag: string,
  attempt = 1
): Promise<boolean> {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    // Wait for page to settle — catch Cloudflare redirects
    await delay(2000);

    // Check if we landed on a Cloudflare challenge or error page
    const currentUrl = page.url();
    if (
      currentUrl.includes("chrome-error") ||
      currentUrl.includes("challenges.cloudflare")
    ) {
      if (attempt <= MAX_RETRIES) {
        console.warn(
          `${tag} Cloudflare challenge detected (attempt ${attempt}/${MAX_RETRIES}), waiting...`
        );
        await delay(10_000 * attempt);
        return navigateWithRetry(page, url, tag, attempt + 1);
      }
      console.error(`${tag} Cloudflare blocked after ${MAX_RETRIES} retries`);
      return false;
    }

    // Wait for product cards or timeout
    try {
      await page.waitForSelector(
        '[data-testid="price-dollars"], div[data-testid*="-EA-"]',
        { timeout: 20_000 }
      );
      return true;
    } catch {
      // No product cards found — could be empty results or Cloudflare
      const html = await page.content();
      if (
        html.includes("Checking your browser") ||
        html.includes("challenge-platform")
      ) {
        if (attempt <= MAX_RETRIES) {
          console.warn(
            `${tag} Cloudflare JS challenge (attempt ${attempt}/${MAX_RETRIES}), waiting...`
          );
          await delay(15_000 * attempt);
          return navigateWithRetry(page, url, tag, attempt + 1);
        }
        console.error(`${tag} Cloudflare challenge not resolved`);
        return false;
      }
      // Genuine empty results — page loaded but no products
      return true;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Handle "navigation interrupted" — page is redirecting (Cloudflare)
    if (msg.includes("interrupted by another navigation")) {
      if (attempt <= MAX_RETRIES) {
        console.warn(
          `${tag} Navigation interrupted (attempt ${attempt}/${MAX_RETRIES}), waiting...`
        );
        // Wait for the redirect to complete
        try {
          await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
        } catch {
          // ignore
        }
        await delay(5000 * attempt);
        return navigateWithRetry(page, url, tag, attempt + 1);
      }
      return false;
    }

    // ERR_TIMED_OUT or other network errors — retry with backoff
    if (
      (msg.includes("ERR_TIMED_OUT") || msg.includes("Timeout")) &&
      attempt <= MAX_RETRIES
    ) {
      console.warn(
        `${tag} Timeout (attempt ${attempt}/${MAX_RETRIES}), retrying in ${10 * attempt}s...`
      );
      await delay(10_000 * attempt);
      return navigateWithRetry(page, url, tag, attempt + 1);
    }

    throw e;
  }
}

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
    // biome-ignore lint/suspicious/noExplicitAny: stealth plugin types don't align with playwright-extra
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

    // Block heavy resources for speed (NOT Cloudflare challenge scripts)
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

    // Warmup: visit homepage with short timeout to establish Cloudflare cookies.
    // Don't wait for networkidle — just domcontentloaded + a pause.
    console.log(`${tag} Warming up (homepage)...`);
    try {
      await page.goto(config.domain, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
    } catch {
      // Homepage timeout is fine — cookies may still be set
    }
    // Let any Cloudflare challenge JS run
    await delay(5000);

    for (let i = 0; i < basket.length; i++) {
      const item = basket[i]!;
      try {
        const query = item.searchQueries[config.storeKey];
        const searchUrl = config.searchUrl(query);
        console.log(`${tag} Searching: ${query} (${item.category})`);

        const success = await navigateWithRetry(page, searchUrl, tag);
        if (!success) {
          console.warn(`${tag} Skipping ${item.category} — navigation failed`);
          if (i < basket.length - 1) {
            await delay(config.delayBetweenSearches);
          }
          continue;
        }

        // Scroll to trigger lazy loads with human-like timing
        for (let s = 0; s < 3; s++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await randomDelay(200, 500);
        }

        // Extract products
        const parsed = await page.evaluate(extractProductsFromPage);

        let matched = 0;
        for (const p of parsed) {
          const fullName = p.name;

          if (!item.sizePatterns.some((re) => re.test(fullName))) {
            continue;
          }
          if (item.excludePatterns.some((re) => re.test(fullName))) {
            continue;
          }
          if (
            item.includePatterns &&
            !item.includePatterns.some((re) => re.test(fullName))
          ) {
            continue;
          }

          if (p.price < item.priceRange.min || p.price > item.priceRange.max) {
            console.warn(
              `${tag} Rejected ${item.category} "$${p.price}" (${fullName}) - out of range`
            );
            continue;
          }

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
            source: searchUrl,
          });
          matched++;
        }

        if (matched === 0) {
          console.warn(
            `${tag} No products matched for ${item.category} (${parsed.length} candidates)`
          );
        } else {
          console.log(`${tag} ${item.category}: ${matched} products matched`);
        }

        // Delay between searches with jitter (skip after last)
        if (i < basket.length - 1) {
          await randomDelay(
            config.delayBetweenSearches,
            config.delayBetweenSearches + 3000
          );
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

  console.log(`${tag} Completed: ${allProducts.length} total products scraped`);
  return allProducts;
}
