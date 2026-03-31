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
 * Extract product name and price from Woolworths search results.
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

  return items;
}

// Register stealth plugin once at module scope
let stealthRegistered = false;

const MAX_RETRIES = 2;

/**
 * Navigate to a Woolworths search URL with retry logic.
 */
async function navigateWithRetry(
  page: import("playwright").Page,
  url: string,
  attempt = 1
): Promise<boolean> {
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
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
          `[woolworths] Cloudflare challenge detected (attempt ${attempt}/${MAX_RETRIES}), waiting...`
        );
        await delay(10_000 * attempt);
        return navigateWithRetry(page, url, attempt + 1);
      }
      console.error(
        `[woolworths] Cloudflare blocked after ${MAX_RETRIES} retries`
      );
      return false;
    }

    // Wait for Angular to render product cards
    try {
      await page.waitForSelector("cdx-card", { timeout: 15_000 });
      return true;
    } catch {
      // Check if we got a Cloudflare challenge
      const html = await page.content();
      if (
        html.includes("Checking your browser") ||
        html.includes("challenge-platform")
      ) {
        if (attempt <= MAX_RETRIES) {
          console.warn(
            `[woolworths] Cloudflare JS challenge (attempt ${attempt}/${MAX_RETRIES}), waiting...`
          );
          await delay(15_000 * attempt);
          return navigateWithRetry(page, url, attempt + 1);
        }
        console.error("[woolworths] Cloudflare challenge not resolved");
        return false;
      }
      // Page loaded but no cdx-card elements — could be empty results
      return true;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Handle "navigation interrupted" — page is redirecting (Cloudflare)
    if (msg.includes("interrupted by another navigation")) {
      if (attempt <= MAX_RETRIES) {
        console.warn(
          `[woolworths] Navigation interrupted (attempt ${attempt}/${MAX_RETRIES}), waiting...`
        );
        try {
          await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
        } catch {
          // ignore
        }
        await delay(5000 * attempt);
        return navigateWithRetry(page, url, attempt + 1);
      }
      return false;
    }

    if (
      (msg.includes("Timeout") || msg.includes("ERR_TIMED_OUT")) &&
      attempt <= MAX_RETRIES
    ) {
      console.warn(
        `[woolworths] Timeout (attempt ${attempt}/${MAX_RETRIES}), retrying...`
      );
      await delay(8000 * attempt);
      return navigateWithRetry(page, url, attempt + 1);
    }
    throw e;
  }
}

export async function scrapeWoolworths(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  console.log("[woolworths] Starting scrape...");

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
    });
    const page = await context.newPage();

    // Block heavy resources for speed (NOT Cloudflare challenge scripts)
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      if (["image", "font", "media"].includes(resourceType)) {
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

    // Warmup: visit homepage to establish session/Cloudflare cookies
    console.log("[woolworths] Warming up (homepage)...");
    try {
      await page.goto("https://www.woolworths.co.nz", {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
    } catch {
      // timeout is fine — cookies should still be set
    }
    // Let any Cloudflare challenge JS run
    await delay(5000);

    for (let i = 0; i < basket.length; i++) {
      const item = basket[i]!;
      try {
        const query = item.searchQueries.woolworths;
        const searchUrl = `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(query)}`;
        console.log(`[woolworths] Searching: ${query} (${item.category})`);

        const success = await navigateWithRetry(page, searchUrl);
        if (!success) {
          console.warn(
            `[woolworths] Skipping ${item.category} — navigation failed`
          );
          if (i < basket.length - 1) {
            await randomDelay(7000, 10_000);
          }
          continue;
        }

        // Scroll to trigger lazy loads with human-like timing
        for (let s = 0; s < 5; s++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await randomDelay(500, 1500);
        }

        const parsed = await page.evaluate(extractProducts);

        let matched = 0;
        for (const p of parsed) {
          if (!item.sizePatterns.some((re) => re.test(p.name))) {
            continue;
          }
          if (item.excludePatterns.some((re) => re.test(p.name))) {
            continue;
          }
          if (
            item.includePatterns &&
            !item.includePatterns.some((re) => re.test(p.name))
          ) {
            continue;
          }

          if (p.price < item.priceRange.min || p.price > item.priceRange.max) {
            console.warn(
              `[woolworths] Rejected ${item.category} "$${p.price}" (${p.name}) - out of range`
            );
            continue;
          }

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
            `[woolworths] No products matched for ${item.category} (${parsed.length} candidates)`
          );
        } else {
          console.log(
            `[woolworths] ${item.category}: ${matched} products matched`
          );
        }

        // Delay with jitter (skip after last)
        if (i < basket.length - 1) {
          await randomDelay(7000, 10_000);
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
