import { chromium, type Browser } from "playwright";
import { readFile } from "node:fs/promises";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser && browser.isConnected()) {
    await browser.close();
    browser = null;
  }
}

/**
 * Download an XLSX file from a URL using Playwright (bypasses Cloudflare).
 * Handles the browser download event that fires when navigating to a file URL.
 * Returns the file contents as a Buffer.
 */
export async function downloadXlsx(url: string): Promise<Buffer> {
  const b = await getBrowser();
  const context = await b.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Set up the download handler BEFORE navigation.
    // When navigating to a file URL, the browser triggers a download event
    // instead of loading the page.
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });

    // Navigate to the XLSX URL — this triggers a download
    page.goto(url, { timeout: 90_000 }).catch(() => {
      // goto will reject with "Download is starting" — that's expected
    });

    const download = await downloadPromise;

    // Wait for the download to complete and get the path
    const filePath = await download.path();
    if (!filePath) {
      throw new Error(`Download failed for ${url}: no file path returned`);
    }

    const buffer = await readFile(filePath);
    return Buffer.from(buffer);
  } finally {
    await context.close();
  }
}
