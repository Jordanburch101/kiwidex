import { type BasketItem, computeNormalizationFactor } from "./basket";
import { extractBrand } from "./brands";
import { USER_AGENT } from "./constants";
import type { ScrapedProduct } from "./types";

export interface FoodstuffsApiConfig {
  apiDomain: string;
  banner: "PNS" | "NW";
  geolocation: { latitude: number; longitude: number };
  siteDomain: string;
  storeKey: "paknsave" | "newworld";
  storeName: string;
}

export const PAKNSAVE_API_CONFIG: FoodstuffsApiConfig = {
  banner: "PNS",
  apiDomain: "https://api-prod.paknsave.co.nz",
  siteDomain: "https://www.paknsave.co.nz",
  storeKey: "paknsave",
  storeName: "paknsave.co.nz",
  geolocation: { latitude: -36.8485, longitude: 174.7633 },
};

export const NEWWORLD_API_CONFIG: FoodstuffsApiConfig = {
  banner: "NW",
  apiDomain: "https://api-prod.newworld.co.nz",
  siteDomain: "https://www.newworld.co.nz",
  storeKey: "newworld",
  storeName: "newworld.co.nz",
  // Albany — full-size supermarket with broad product range.
  // CBD resolves to "Metro Auckland" which is a small convenience store
  // with limited stock (e.g. no 1kg cheese blocks).
  geolocation: { latitude: -36.7275, longitude: 174.6966 },
};

interface AlgoliaHit {
  averagePrice: number;
  brand: string;
  DisplayName: string;
  fan: string;
  longDescription?: string;
  weightDisplayName?: string;
}

interface DecoratedProduct {
  brand: string;
  displayName: string;
  name: string;
  productId: string;
  singlePrice?: {
    price: number;
    comparativePrice?: {
      pricePerUnit: number;
      unitQuantity: number;
      unitQuantityUom: string;
      measureDescription: string;
    };
  };
}

/**
 * Get an anonymous access token for the Foodstuffs API.
 * Tokens are short-lived (~30min) and require no credentials.
 */
async function getAnonymousToken(config: FoodstuffsApiConfig): Promise<string> {
  const res = await fetch(`${config.siteDomain}/api/user/get-current-user`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      fingerprintUser: `kiwidex-${config.storeKey}-${Date.now()}`,
      fingerprintGuest: USER_AGENT,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Look up the nearest store for a given geolocation.
 */
async function getNearestStoreId(config: FoodstuffsApiConfig): Promise<string> {
  const { latitude, longitude } = config.geolocation;
  const res = await fetch(
    `${config.siteDomain}/next/api/stores/geolocation?lat=${latitude}&lng=${longitude}`,
    {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Store lookup failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { data: { id: string; name: string } };
  return data.data.id;
}

/**
 * Search for products using the Algolia-backed search API.
 */
async function searchProducts(
  config: FoodstuffsApiConfig,
  token: string,
  storeId: string,
  query: string
): Promise<AlgoliaHit[]> {
  const res = await fetch(
    `${config.apiDomain}/v1/edge/search/products/query/index/products-index-popularity-desc`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        algoliaQuery: {
          query,
          hitsPerPage: 30,
          facetFilters: [[`stores:${storeId}`], ["tobacco:false"]],
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { hits: AlgoliaHit[] };
  return data.hits || [];
}

/**
 * Get store-specific prices for a list of product IDs.
 */
async function decorateProducts(
  config: FoodstuffsApiConfig,
  token: string,
  storeId: string,
  productIds: string[]
): Promise<DecoratedProduct[]> {
  if (productIds.length === 0) {
    return [];
  }

  const res = await fetch(
    `${config.apiDomain}/v1/edge/store/${storeId}/decorateProducts`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ productIds }),
    }
  );

  if (!res.ok) {
    throw new Error(`Decorate failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { products: DecoratedProduct[] };
  return data.products || [];
}

/**
 * Build a full product name from Algolia hit + decorated data.
 * The Algolia hit has `DisplayName` (e.g. "Standard Milk") and `brand`.
 * The decorated product has `name` and `displayName` (size like "2l").
 * We combine all parts so basket filters can match against the full text.
 */
function buildFullName(hit: AlgoliaHit, decorated?: DecoratedProduct): string {
  const parts = [
    hit.brand,
    decorated?.name || hit.DisplayName,
    decorated?.displayName || hit.weightDisplayName || "",
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Scrape all matching products from a Foodstuffs store using the direct API.
 * Drop-in replacement for the Playwright-based scrapeFoodstuffs().
 */
export async function scrapeFoodstuffsApi(
  config: FoodstuffsApiConfig,
  basket: BasketItem[]
): Promise<ScrapedProduct[]> {
  const tag = `[${config.storeKey}]`;
  console.log(`${tag} Starting API scrape...`);

  const token = await getAnonymousToken(config);
  const storeId = await getNearestStoreId(config);
  console.log(`${tag} Authenticated, store: ${storeId}`);

  const allProducts: ScrapedProduct[] = [];

  for (const item of basket) {
    const query = item.searchQueries[config.storeKey];
    console.log(`${tag} Searching: ${query} (${item.category})`);

    try {
      const hits = await searchProducts(config, token, storeId, query);

      if (hits.length === 0) {
        console.warn(`${tag} No results for ${item.category}`);
        continue;
      }

      // Build product IDs for price decoration
      const eaIds = hits.map((h) => `${h.fan}-EA-000`);
      const decorated = await decorateProducts(config, token, storeId, eaIds);

      // Index decorated products by FAN for fast lookup
      const priceMap = new Map<string, DecoratedProduct>();
      for (const d of decorated) {
        const fan = d.productId.split("-")[0]!;
        priceMap.set(fan, d);
      }

      let matched = 0;
      for (const hit of hits) {
        const dec = priceMap.get(hit.fan);
        // decorateProducts returns price in cents; averagePrice is already in dollars
        const shelfPrice = dec?.singlePrice
          ? dec.singlePrice.price / 100
          : hit.averagePrice;

        const fullName = buildFullName(hit, dec);

        // Apply basket filters
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
        // e.g. 500g cheese at $9.49 → $18.98/kg
        const normFactor = computeNormalizationFactor(
          fullName,
          item.standardUnit
        );
        const price = Math.round(shelfPrice * normFactor * 100) / 100;

        if (price < item.priceRange.min || price > item.priceRange.max) {
          console.warn(
            `${tag} Rejected ${item.category} "$${price}" (${fullName}) - out of range`
          );
          continue;
        }

        const productId = fullName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const unitPrice = dec?.singlePrice?.comparativePrice
          ? `$${(dec.singlePrice.comparativePrice.pricePerUnit / 100).toFixed(2)}/${dec.singlePrice.comparativePrice.unitQuantityUom}`
          : undefined;

        allProducts.push({
          productId,
          store: config.storeName,
          category: item.category,
          name: fullName,
          brand: extractBrand(fullName) || hit.brand || "",
          size: item.standardUnit,
          price,
          unitPrice,
          source: `${config.siteDomain}/shop/search?q=${encodeURIComponent(query)}`,
        });
        matched++;
      }

      if (matched === 0) {
        console.warn(
          `${tag} No products matched for ${item.category} (${hits.length} candidates)`
        );
      } else {
        console.log(`${tag} ${item.category}: ${matched} products matched`);
      }
    } catch (e) {
      console.error(
        `${tag} Error scraping ${item.category}: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  console.log(`${tag} Completed: ${allProducts.length} total products scraped`);
  return allProducts;
}
