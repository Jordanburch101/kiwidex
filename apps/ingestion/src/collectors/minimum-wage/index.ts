import type { CollectorResult } from "../types";

/**
 * NZ minimum wage history.
 * Updated annually (effective April 1). Add new entries at the top.
 */
const WAGE_HISTORY: Array<{ date: string; value: number }> = [
  { date: "2025-04-01", value: 23.5 },
  { date: "2024-04-01", value: 23.15 },
  { date: "2023-04-01", value: 22.7 },
  { date: "2022-04-01", value: 21.2 },
  { date: "2021-04-01", value: 20.0 },
  { date: "2020-04-01", value: 18.9 },
  { date: "2019-04-01", value: 17.7 },
  { date: "2018-04-01", value: 16.5 },
  { date: "2017-04-01", value: 15.75 },
  { date: "2016-04-01", value: 15.25 },
  { date: "2015-04-01", value: 14.75 },
  { date: "2014-04-01", value: 14.25 },
  { date: "2013-04-01", value: 13.75 },
  { date: "2012-04-01", value: 13.5 },
  { date: "2011-04-01", value: 13.0 },
  { date: "2010-04-01", value: 12.75 },
  { date: "2009-04-01", value: 12.5 },
  { date: "2008-04-01", value: 12.0 },
];

/**
 * Minimum wage collector: returns the known NZ minimum wage history.
 * This is a static dataset updated once per year, so scraping is unnecessary.
 */
export default async function collectMinimumWage(): Promise<CollectorResult[]> {
  const results: CollectorResult[] = WAGE_HISTORY.map((entry) => ({
    metric: "minimum_wage" as const,
    value: entry.value,
    unit: "nzd_per_hour",
    date: entry.date,
    source: "https://www.employment.govt.nz/hours-and-wages/pay/minimum-wage/",
  }));

  // Warn if data may be stale (latest entry > 13 months old)
  const latestDate = new Date(WAGE_HISTORY[0]!.date);
  const monthsSince =
    (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSince > 13) {
    console.warn(
      `[minimum-wage] Data may be stale — latest entry is ${WAGE_HISTORY[0]!.date}. Check if a new minimum wage has been announced.`
    );
  }

  console.log(`[minimum-wage] ${results.length} data points collected`);
  return results;
}
