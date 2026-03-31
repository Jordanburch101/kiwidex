/**
 * Standalone script to scrape a single grocery store.
 * Usage: bun run src/collectors/groceries/scrape-store.ts <store>
 * Where <store> is: woolworths, paknsave, or newworld
 *
 * Writes scraped products as JSON to stdout for the aggregator to consume.
 * Logs go to stderr so they don't pollute the JSON output.
 */
import { BASKET } from "./basket";
import { scrapeNewWorld } from "./newworld";
import { scrapePakNSave } from "./paknsave";
import type { ScrapedProduct } from "./types";
import { scrapeWoolworthsApi } from "./woolworths-api";

// Redirect console.log to stderr so stdout is clean JSON
console.log = (...args: unknown[]) => console.error(...args);

const store = process.argv[2];

const scrapers: Record<
  string,
  (basket: typeof BASKET) => Promise<ScrapedProduct[]>
> = {
  woolworths: scrapeWoolworthsApi,
  paknsave: scrapePakNSave,
  newworld: scrapeNewWorld,
};

if (!(store && scrapers[store])) {
  console.error(
    "Usage: bun run scrape-store.ts <woolworths|paknsave|newworld>"
  );
  process.exit(1);
}

try {
  const results = await scrapers[store]!(BASKET);
  // Write JSON to stdout for the aggregator
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
} catch (e) {
  console.error(
    `[${store}] Fatal error: ${e instanceof Error ? e.message : e}`
  );
  // Write empty array on failure so aggregator can continue
  process.stdout.write("[]");
  process.exit(1);
}
