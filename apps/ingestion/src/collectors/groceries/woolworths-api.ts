import { type BasketItem, computeNormalizationFactor } from "./basket";
import { extractBrand } from "./brands";
import { USER_AGENT } from "./constants";
import type { ScrapedProduct } from "./types";

const SEARCH_URL = "https://www.woolworths.co.nz/api/v1/products";

interface WoolworthsProduct {
  brand: string;
  name: string;
  price: {
    originalPrice: number;
    salePrice: number;
  };
  size: {
    cupPrice: number;
    cupMeasure: string;
    packageType: string;
    volumeSize: string;
  };
  sku: string;
  type: string;
}

interface WoolworthsSearchResponse {
  products: {
    items: WoolworthsProduct[];
    totalItems: number;
  };
}

/**
 * Search Woolworths NZ products via their internal API.
 * Requires a session cookie from the homepage — without it,
 * the CDN blocks requests from cloud hosting IPs (e.g. Railway).
 */
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Module-level session state, set by initSession(). */
let sessionCookies = "";
let sessionFailed = false;

/**
 * Establish a session by fetching the Woolworths homepage.
 * The CDN sets tracking/session cookies that must be included
 * in subsequent API requests, otherwise cloud IPs get blocked.
 *
 * If this fails (e.g. timeout on Railway), sets sessionFailed=true
 * so the scraper can bail early instead of burning time on doomed retries.
 */
async function initSession(): Promise<void> {
  try {
    const res = await fetch("https://www.woolworths.co.nz/", {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-NZ,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    const setCookieHeaders = res.headers.getSetCookie();
    sessionCookies = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");

    // Consume response body to free connection
    await res.text();

    if (sessionCookies) {
      console.log(
        `[woolworths] Session established (${setCookieHeaders.length} cookies)`
      );
    } else {
      console.warn("[woolworths] No session cookies received");
    }
  } catch (e) {
    sessionFailed = true;
    console.warn(
      `[woolworths] Session init failed (CDN may be blocking this IP): ${e instanceof Error ? e.message : e}`
    );
  }
}

async function searchProducts(
  query: string,
  attempt = 1
): Promise<WoolworthsProduct[]> {
  const url = `${SEARCH_URL}?target=search&search=${encodeURIComponent(query)}&inStockProductsOnly=false&size=48`;

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "x-requested-with": "OnlineShopping.WebApp",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-NZ,en;q=0.9",
    Origin: "https://www.woolworths.co.nz",
    Referer: `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(query)}`,
  };

  if (sessionCookies) {
    headers.Cookie = sessionCookies;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(
        `Woolworths search failed: ${res.status} ${res.statusText}`
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const body = await res.text();
      throw new Error(
        `Woolworths returned non-JSON (${contentType}): ${body.slice(0, 200)}`
      );
    }

    const data = (await res.json()) as WoolworthsSearchResponse;
    return (data.products?.items || []).filter((p) => p.type === "Product");
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      const backoff = attempt * 5000;
      console.warn(
        `[woolworths] Retry ${attempt}/${MAX_RETRIES} for "${query}" in ${backoff / 1000}s: ${e instanceof Error ? e.message : e}`
      );
      await delay(backoff);
      return searchProducts(query, attempt + 1);
    }
    throw e;
  }
}

/**
 * Build a full product name matching the format the Playwright scraper produced.
 * Woolworths DOM showed: "brand name variety packageType volumeSize"
 */
function buildFullName(product: WoolworthsProduct): string {
  const parts = [
    product.name,
    product.size?.packageType || "",
    product.size?.volumeSize || "",
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Scrape all matching products from Woolworths NZ using the direct API.
 * Drop-in replacement for the Playwright-based scrapeWoolworths().
 */
export async function scrapeWoolworthsApi(
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  console.log("[woolworths] Starting API scrape...");

  await initSession();

  if (sessionFailed) {
    console.warn(
      "[woolworths] Skipping — cannot reach woolworths.co.nz (IP likely blocked by CDN)"
    );
    return [];
  }

  const allProducts: ScrapedProduct[] = [];

  for (const item of basket) {
    const query = item.searchQueries.woolworths;
    console.log(`[woolworths] Searching: ${query} (${item.category})`);

    try {
      const products = await searchProducts(query);

      if (products.length === 0) {
        console.warn(`[woolworths] No results for ${item.category}`);
        continue;
      }

      let matched = 0;
      for (const p of products) {
        const fullName = buildFullName(p);
        const shelfPrice = p.price?.salePrice ?? p.price?.originalPrice;

        if (!shelfPrice || shelfPrice <= 0) {
          continue;
        }

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

        // Normalize price when product size differs from standard unit
        const normFactor = computeNormalizationFactor(
          fullName,
          item.standardUnit
        );
        const price = Math.round(shelfPrice * normFactor * 100) / 100;

        if (price < item.priceRange.min || price > item.priceRange.max) {
          console.warn(
            `[woolworths] Rejected ${item.category} "$${price}" (${fullName}) - out of range`
          );
          continue;
        }

        const productId = fullName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const unitPrice =
          p.size?.cupPrice && p.size?.cupMeasure
            ? `$${p.size.cupPrice}/${p.size.cupMeasure}`
            : undefined;

        allProducts.push({
          productId,
          store: "woolworths.co.nz",
          category: item.category,
          name: fullName,
          brand: extractBrand(fullName) || p.brand || "",
          size: item.standardUnit,
          price,
          unitPrice,
          source: `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(query)}`,
        });
        matched++;
      }

      if (matched === 0) {
        console.warn(
          `[woolworths] No products matched for ${item.category} (${products.length} candidates)`
        );
      } else {
        console.log(
          `[woolworths] ${item.category}: ${matched} products matched`
        );
      }
    } catch (e) {
      console.error(
        `[woolworths] Error scraping ${item.category}: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  console.log(
    `[woolworths] Completed: ${allProducts.length} total products scraped`
  );
  return allProducts;
}
