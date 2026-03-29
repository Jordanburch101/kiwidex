import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

/**
 * Download multiple XLSX files from URLs using a single Playwright browser session.
 * Launches a fresh browser per call (no shared singleton) to avoid concurrency issues.
 * Returns a Map of URL → Buffer.
 */
export async function downloadXlsxFiles(
  urls: string[]
): Promise<Map<string, Buffer>> {
  const browser = await chromium.launch({ headless: true });
  const results = new Map<string, Buffer>();

  try {
    for (const url of urls) {
      const context = await browser.newContext({
        acceptDownloads: true,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      try {
        const downloadPromise = page.waitForEvent("download", {
          timeout: 90_000,
        });

        page.goto(url, { timeout: 90_000 }).catch(() => {
          // goto rejects with "Download is starting" — expected for file URLs
        });

        const download = await downloadPromise;
        const filePath = await download.path();
        if (!filePath) {
          throw new Error(`Download failed for ${url}: no file path returned`);
        }

        const buffer = await readFile(filePath);
        results.set(url, Buffer.from(buffer));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Download a single XLSX file. Convenience wrapper around downloadXlsxFiles.
 */
export async function downloadXlsx(url: string): Promise<Buffer> {
  const results = await downloadXlsxFiles([url]);
  const buffer = results.get(url);
  if (!buffer) {
    throw new Error(`Download failed for ${url}`);
  }
  return buffer;
}
