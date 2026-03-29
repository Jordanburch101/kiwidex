import type { CollectorResult } from "../types";

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

/**
 * Build the REINZ press release URL for a given month.
 * Pattern: https://www.reinz.co.nz/Web/Web/News/News-Articles/Market-updates/REINZ_[Month]_[Year]_Data.aspx
 */
function buildUrl(year: number, month: number): string {
  const monthName = MONTH_NAMES[month];
  return `https://www.reinz.co.nz/Web/Web/News/News-Articles/Market-updates/REINZ_${monthName}_${year}_Data.aspx`;
}

/**
 * Extract national median house price from REINZ press release HTML.
 * Looks for dollar amounts like "$795,000" near keywords like "median price" or "national median".
 */
function extractMedianPrice(html: string): number | null {
  // Look for patterns like "to $795,000" or "at $795,000" or "of $795,000"
  // near "median price" or "national median"
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
      // Sanity check: median house price should be between $100k and $5M
      if (value >= 100_000 && value <= 5_000_000) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Get the date string (last day of month) for the data month.
 */
function getMonthEndDate(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.toISOString().slice(0, 10);
}

/**
 * REINZ collector: fetches the latest monthly press release and extracts
 * the national median house price.
 *
 * Tries the most recent month first (current - 1), then falls back to
 * the month before if not yet published.
 */
export default async function collectREINZ(): Promise<CollectorResult[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Try most recent month first (previous month), then one before
  const monthsToTry = [
    { year: currentYear, month: currentMonth - 1 },
    { year: currentYear, month: currentMonth - 2 },
  ].map(({ year, month }) => {
    // Handle year boundary (e.g., January -> December of previous year)
    if (month < 0) {
      return { year: year - 1, month: month + 12 };
    }
    return { year, month };
  });

  for (const { year, month } of monthsToTry) {
    const url = buildUrl(year, month);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        console.log(
          `[reinz] ${MONTH_NAMES[month]} ${year}: HTTP ${response.status}, trying next month`
        );
        continue;
      }

      const html = await response.text();
      const price = extractMedianPrice(html);

      if (price === null) {
        console.warn(
          `[reinz] ${MONTH_NAMES[month]} ${year}: page loaded but could not extract median price`
        );
        continue;
      }

      const date = getMonthEndDate(year, month);
      console.log(
        `[reinz] ${MONTH_NAMES[month]} ${year}: median house price $${price.toLocaleString()}`
      );

      return [
        {
          metric: "house_price_median" as const,
          value: price,
          unit: "nzd",
          date,
          source: url,
        },
      ];
    } catch (e) {
      console.warn(`[reinz] ${MONTH_NAMES[month]} ${year}: fetch failed: ${e}`);
    }
  }

  throw new Error(
    "REINZ collector: could not find or parse any recent press release"
  );
}
