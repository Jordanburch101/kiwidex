import {
  db,
  getLatestStockQuote,
  insertStocks,
  type NewStock,
} from "@workspace/db";
import YahooFinance from "yahoo-finance2";
import type { CollectorResult } from "../types";

const TICKERS = [
  { symbol: "^NZ50", metric: "nzx_50" as const },
  { symbol: "AIR.NZ", metric: null },
  { symbol: "FPH.NZ", metric: null },
  { symbol: "MEL.NZ", metric: null },
  { symbol: "FBU.NZ", metric: null },
] as const;

const SOURCE = "https://finance.yahoo.com";
const BACKFILL_DAYS = 730; // ~2 years
const RECENT_DAYS = 7;

export default async function collectStocks(): Promise<CollectorResult[]> {
  const yahooFinance = new YahooFinance();

  const latest = await getLatestStockQuote(db, "^NZ50");
  const hasData = latest !== null;
  const daysBack = hasData ? RECENT_DAYS : BACKFILL_DAYS;

  const period1 = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const period2 = new Date();

  console.log(
    `[stocks] ${hasData ? "Incremental" : "Backfill"} fetch: ${period1.toISOString().split("T")[0]} → ${period2.toISOString().split("T")[0]}`
  );

  const allStockRows: NewStock[] = [];
  const metricResults: CollectorResult[] = [];

  for (const { symbol, metric } of TICKERS) {
    try {
      const result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: "1d",
      });

      const quotes = result.quotes;
      const rows: NewStock[] = [];

      for (const quote of quotes) {
        // Skip rows with null close (can happen for current trading day)
        if (
          quote.close == null ||
          quote.open == null ||
          quote.high == null ||
          quote.low == null
        ) {
          continue;
        }

        const date = new Date(quote.date).toISOString().split("T")[0]!;
        rows.push({
          ticker: symbol,
          date,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume ?? null,
        });
      }

      allStockRows.push(...rows);

      // Mirror NZX 50 close to metrics table
      if (metric) {
        for (const row of rows) {
          metricResults.push({
            metric,
            value: row.close,
            unit: "index",
            date: row.date,
            source: SOURCE,
          });
        }
      }

      console.log(`  ${symbol}: ${rows.length} rows`);
    } catch (e) {
      console.error(
        `  ${symbol}: FAILED — ${e instanceof Error ? e.message : e}`
      );
    }
  }

  // Write OHLC data to stocks table
  if (allStockRows.length > 0) {
    await insertStocks(db, allStockRows);
    console.log(`[stocks] ${allStockRows.length} total OHLC rows written`);
  }

  // Return metric results for bulkInsert in collect-all.ts
  return metricResults;
}
