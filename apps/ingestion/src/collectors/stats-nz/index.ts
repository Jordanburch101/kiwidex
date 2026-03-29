import { downloadXlsxFiles } from "../../lib/xlsx-downloader";
import type { CollectorResult } from "../types";
import { parseMSeriesFile } from "./m-series-parser";

const URLS = {
  m1: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/m/m1/hm1.xlsx",
  m5: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/m/m5/hm5.xlsx",
  m9: "https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/m/m9/hm9.xlsx",
} as const;

const FILE_CONFIGS = [
  {
    name: "M1 Prices",
    url: URLS.m1,
    columns: [
      {
        seriesId: "CPI.Q.C.iay",
        metric: "cpi" as const,
        unit: "percent",
      },
    ],
  },
  {
    name: "M5 GDP",
    url: URLS.m5,
    columns: [
      {
        seriesId: "GDP06.Q.QT0.rsq",
        metric: "gdp_growth" as const,
        unit: "percent",
      },
    ],
  },
  {
    name: "M9 Labour",
    url: URLS.m9,
    columns: [
      {
        seriesId: "HLFS.Q.L06G001.ns",
        metric: "unemployment" as const,
        unit: "percent",
      },
      {
        seriesId: "LCI.Q.W1S0T0.iay",
        metric: "wage_growth" as const,
        unit: "percent",
      },
      {
        seriesId: "QESS21.Q.E03S0.na",
        metric: "median_income" as const,
        unit: "nzd",
        // Average hourly earnings (NZD) → approximate annual: hourly * 40hrs * 52wks
        // NOTE: This is AVERAGE (not median) hourly earnings × 2080. It will be
        // ~$90–100k, higher than the true NZ median income (~$65k). Used as a
        // programmatic proxy until Stats NZ HES annual survey data is available.
        transform: (hourly: number) => Number((hourly * 40 * 52).toFixed(0)),
      },
    ],
  },
];

interface ParseResult {
  error?: string;
  name: string;
  results: CollectorResult[];
}

function tryParse(
  name: string,
  buffer: Buffer | undefined,
  downloadError: string | undefined,
  columns: (typeof FILE_CONFIGS)[number]["columns"],
  source: string
): ParseResult {
  if (!buffer) {
    return { name, results: [], error: downloadError ?? "Download failed" };
  }
  try {
    const results = parseMSeriesFile(buffer, columns, source);
    console.log(`[stats-nz] ${name}: ${results.length} data points`);
    return { name, results };
  } catch (e) {
    const msg = `Failed to parse ${name}: ${e}`;
    console.error(`[stats-nz] ${msg}`);
    return { name, results: [], error: msg };
  }
}

/**
 * Stats NZ collector: downloads M1 (Prices), M5 (GDP), and M9 (Labour)
 * from RBNZ's consolidated Stats NZ M-series XLSX files.
 * Uses a single browser session for all downloads.
 */
export default async function collectStatsNZ(): Promise<CollectorResult[]> {
  const allUrls = FILE_CONFIGS.map((c) => c.url);
  const fileMap = await downloadXlsxFiles(allUrls);

  const parses = FILE_CONFIGS.map((config) =>
    tryParse(
      config.name,
      fileMap.get(config.url),
      fileMap.has(config.url) ? undefined : "Download failed",
      config.columns,
      config.url
    )
  );

  const results = parses.flatMap((p) => p.results);
  const errors = parses.filter((p) => p.error).map((p) => p.error);

  if (errors.length > 0 && results.length === 0) {
    throw new Error(`All Stats NZ collectors failed:\n${errors.join("\n")}`);
  }

  if (errors.length > 0) {
    console.warn(`[stats-nz] Partial success. Errors:\n${errors.join("\n")}`);
  }

  console.log(`[stats-nz] Total: ${results.length} data points collected`);
  return results;
}
