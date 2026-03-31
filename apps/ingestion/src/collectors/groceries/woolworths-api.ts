import type { BasketItem } from "./basket";
import { extractBrand } from "./brands";
import type { ScrapedProduct } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
 * No auth needed — just the x-requested-with header.
 */
async function searchProducts(query: string): Promise<WoolworthsProduct[]> {
  const url = `${SEARCH_URL}?target=search&search=${encodeURIComponent(query)}&inStockProductsOnly=false&size=48`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "x-requested-with": "OnlineShopping.WebApp",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Woolworths search failed: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as WoolworthsSearchResponse;
  return (data.products?.items || []).filter((p) => p.type === "Product");
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
        const price = p.price?.salePrice ?? p.price?.originalPrice;

        if (!price || price <= 0) {
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
