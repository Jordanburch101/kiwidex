import { downloadXlsxFiles } from "../../lib/xlsx-downloader";
import type { CollectorResult } from "../types";
import { parseExchangeRates } from "./exchange-rates";
import { parseMortgageRates } from "./mortgage-rates";
import { parseOCR } from "./ocr";

const URLS = {
  b1: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b1/hb1-daily.xlsx",
  b1_archive:
    "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b1/hb1-daily-1999-2017.xlsx",
  b2: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b2/hb2-daily-close.xlsx",
  b2_archive:
    "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b2/hb2-daily-close-1985-2017.xlsx",
  b20: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/b/b20/hb20.xlsx",
} as const;

interface ParseResult {
  error?: string;
  name: string;
  results: CollectorResult[];
}

function tryParse(
  name: string,
  buffer: Buffer | undefined,
  downloadError: string | undefined,
  parser: (buf: Buffer) => CollectorResult[]
): ParseResult {
  if (!buffer) {
    return { name, results: [], error: downloadError ?? "Download failed" };
  }
  try {
    const results = parser(buffer);
    console.log(`[rbnz] ${name}: ${results.length} data points`);
    return { name, results };
  } catch (e) {
    const msg = `Failed to parse ${name}: ${e}`;
    console.error(`[rbnz] ${msg}`);
    return { name, results: [], error: msg };
  }
}

/**
 * RBNZ collector: downloads exchange rates (B1), OCR (B2), and mortgage rates (B20)
 * from the Reserve Bank of New Zealand website.
 * Uses a single browser session for all downloads, cleaned up automatically.
 */
export default async function collectRBNZ(): Promise<CollectorResult[]> {
  const allUrls = [
    URLS.b1,
    URLS.b1_archive,
    URLS.b2,
    URLS.b2_archive,
    URLS.b20,
  ];
  const fileMap = await downloadXlsxFiles(allUrls);

  const parses = [
    tryParse(
      "B1 exchange rates",
      fileMap.get(URLS.b1),
      fileMap.has(URLS.b1) ? undefined : "Download failed",
      parseExchangeRates
    ),
    tryParse(
      "B1 exchange rates (1999-2017)",
      fileMap.get(URLS.b1_archive),
      fileMap.has(URLS.b1_archive) ? undefined : "Download failed",
      parseExchangeRates
    ),
    tryParse(
      "B2 OCR",
      fileMap.get(URLS.b2),
      fileMap.has(URLS.b2) ? undefined : "Download failed",
      parseOCR
    ),
    tryParse(
      "B2 OCR (1985-2017)",
      fileMap.get(URLS.b2_archive),
      fileMap.has(URLS.b2_archive) ? undefined : "Download failed",
      parseOCR
    ),
    tryParse(
      "B20 mortgage rates",
      fileMap.get(URLS.b20),
      fileMap.has(URLS.b20) ? undefined : "Download failed",
      parseMortgageRates
    ),
  ];

  const results = parses.flatMap((p) => p.results);
  const errors = parses.filter((p) => p.error).map((p) => p.error);

  if (errors.length > 0 && results.length === 0) {
    throw new Error(`All RBNZ collectors failed:\n${errors.join("\n")}`);
  }

  if (errors.length > 0) {
    console.warn(`[rbnz] Partial success. Errors:\n${errors.join("\n")}`);
  }

  console.log(`[rbnz] Total: ${results.length} data points collected`);
  return results;
}
