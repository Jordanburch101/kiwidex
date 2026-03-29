import type { CollectorResult } from "../types";
import { downloadXlsx, closeBrowser } from "../../lib/xlsx-downloader";
import { parseExchangeRates } from "./exchange-rates";
import { parseOCR } from "./ocr";
import { parseMortgageRates } from "./mortgage-rates";

const URLS = {
  b1: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b1/hb1-daily.xlsx",
  b2: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b2/hb2-daily-close.xlsx",
  b20: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b20/hb20.xlsx",
} as const;

/**
 * RBNZ collector: downloads exchange rates (B1), OCR (B2), and mortgage rates (B20)
 * from the Reserve Bank of New Zealand website.
 */
export default async function collectRBNZ(): Promise<CollectorResult[]> {
  const results: CollectorResult[] = [];
  const errors: string[] = [];

  try {
    // Download all 3 files using a shared browser instance
    const downloads = await Promise.allSettled([
      downloadXlsx(URLS.b1),
      downloadXlsx(URLS.b2),
      downloadXlsx(URLS.b20),
    ]);

    // B1 — Exchange Rates
    if (downloads[0].status === "fulfilled") {
      try {
        const exchangeResults = parseExchangeRates(downloads[0].value);
        results.push(...exchangeResults);
        console.log(`[rbnz] B1 exchange rates: ${exchangeResults.length} data points`);
      } catch (e) {
        const msg = `[rbnz] Failed to parse B1 exchange rates: ${e}`;
        console.error(msg);
        errors.push(msg);
      }
    } else {
      const msg = `[rbnz] Failed to download B1: ${downloads[0].reason}`;
      console.error(msg);
      errors.push(msg);
    }

    // B2 — OCR
    if (downloads[1].status === "fulfilled") {
      try {
        const ocrResults = parseOCR(downloads[1].value);
        results.push(...ocrResults);
        console.log(`[rbnz] B2 OCR: ${ocrResults.length} data points`);
      } catch (e) {
        const msg = `[rbnz] Failed to parse B2 OCR: ${e}`;
        console.error(msg);
        errors.push(msg);
      }
    } else {
      const msg = `[rbnz] Failed to download B2: ${downloads[1].reason}`;
      console.error(msg);
      errors.push(msg);
    }

    // B20 — Mortgage Rates
    if (downloads[2].status === "fulfilled") {
      try {
        const mortgageResults = parseMortgageRates(downloads[2].value);
        results.push(...mortgageResults);
        console.log(`[rbnz] B20 mortgage rates: ${mortgageResults.length} data points`);
      } catch (e) {
        const msg = `[rbnz] Failed to parse B20 mortgage rates: ${e}`;
        console.error(msg);
        errors.push(msg);
      }
    } else {
      const msg = `[rbnz] Failed to download B20: ${downloads[2].reason}`;
      console.error(msg);
      errors.push(msg);
    }

    if (errors.length > 0 && results.length === 0) {
      throw new Error(`All RBNZ collectors failed:\n${errors.join("\n")}`);
    }

    if (errors.length > 0) {
      console.warn(`[rbnz] Partial success. Errors:\n${errors.join("\n")}`);
    }

    console.log(`[rbnz] Total: ${results.length} data points collected`);
    return results;
  } finally {
    await closeBrowser();
  }
}
