/**
 * One-time backfill script to import historical REINZ median house prices.
 *
 * Iterates through monthly REINZ press releases and extracts national
 * median house prices using the same regex logic as the live collector.
 *
 * Usage: DATABASE_URL=file:../../packages/db/local.db bun run src/backfill-reinz-history.ts
 */
import { bulkInsert, db } from "@workspace/db";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// How far back to go
const START_YEAR = 2022;
const START_MONTH = 0; // 0-indexed (January)

function buildUrl(year: number, month: number): string {
  return `https://www.reinz.co.nz/Web/Web/News/News-Articles/Market-updates/REINZ_${MONTH_NAMES[month]}_${year}_Data.aspx`;
}

function extractMedianPrice(html: string): number | null {
  const patterns = [
    /national median (?:house )?price[^$]*?\$([0-9,]+)/i,
    /median (?:house )?price[^$]*?\$([0-9,]+)/i,
    /(?:to|at|of|was|reached|hit) \$([0-9,]+)[^.]*median/i,
    /median[^$]*?\$([0-9,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, ""));
      if (value >= 100_000 && value <= 5_000_000) {
        return value;
      }
    }
  }

  return null;
}

function getMonthEndDate(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() - 1; // Don't try current month

  const results: {
    metric: "house_price_median";
    value: number;
    unit: string;
    date: string;
    source: string;
  }[] = [];

  let year = START_YEAR;
  let month = START_MONTH;

  console.log(
    `Backfilling REINZ data from ${MONTH_NAMES[START_MONTH]} ${START_YEAR}...`
  );

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const url = buildUrl(year, month);
    const label = `${MONTH_NAMES[month]} ${year}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.log(`  ${label}: HTTP ${response.status} — skipped`);
      } else {
        const html = await response.text();
        const price = extractMedianPrice(html);

        if (price) {
          const date = getMonthEndDate(year, month);
          results.push({
            metric: "house_price_median",
            value: price,
            unit: "nzd",
            date,
            source: url,
          });
          console.log(
            `  ${label}: $${price.toLocaleString()} ✓`
          );
        } else {
          console.log(`  ${label}: page loaded but no price found`);
        }
      }
    } catch (e) {
      console.log(`  ${label}: fetch failed — ${e}`);
    }

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 500));

    // Next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  if (results.length === 0) {
    console.log("\nNo data points found.");
    return;
  }

  console.log(`\nInserting ${results.length} data points...`);
  await bulkInsert(db, results);
  console.log("Done!");
}

main().catch(console.error);
