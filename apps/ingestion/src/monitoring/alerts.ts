import {
  db,
  getLatestRuns,
  getStaleCollectors,
  type ScraperRun,
} from "@workspace/db";
import { Resend } from "resend";

const STALE_THRESHOLD_DAYS = 3;
const DEGRADED_PRODUCT_THRESHOLD = 25;

// Track which issues we've already alerted on to avoid spam
const alertedIssues = new Set<string>();

export async function sendAlert(
  subject: string,
  htmlBody: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[alerts] RESEND_API_KEY not set, skipping email alert");
    console.warn(`[alerts] Would have sent: ${subject}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL || "NZ Ecom <alerts@resend.dev>",
    to: process.env.ALERT_TO_EMAIL || "admin@example.com",
    subject,
    html: htmlBody,
  });

  console.log(`[alerts] Sent alert: ${subject}`);
}

function buildAlertHtml(
  issue: string,
  details: {
    error?: string;
    lastSuccess?: string;
    action?: string;
  }
): string {
  const lines: string[] = [
    "<h2>NZ Ecom Scraper Alert</h2>",
    `<p><strong>Issue:</strong> ${issue}</p>`,
  ];

  if (details.error) {
    lines.push(`<p><strong>Error:</strong> ${details.error}</p>`);
  }

  if (details.lastSuccess) {
    lines.push(
      `<p><strong>Last successful run:</strong> ${details.lastSuccess}</p>`
    );
  }

  if (details.action) {
    lines.push(`<p><strong>Action needed:</strong> ${details.action}</p>`);
  }

  return lines.join("\n");
}

export async function checkAndAlert(): Promise<void> {
  const latestRuns = await getLatestRuns(db);
  const staleCollectors = await getStaleCollectors(db, STALE_THRESHOLD_DAYS);

  // Check for failed collectors
  for (const run of latestRuns) {
    const key = run.store ? `${run.collector}:${run.store}` : run.collector;

    if (run.status === "failed") {
      const issueKey = `failed:${key}`;
      if (!alertedIssues.has(issueKey)) {
        alertedIssues.add(issueKey);
        await sendAlert(
          `Scraper Failed: ${key}`,
          buildAlertHtml(`${key} scraper failed`, {
            error: run.error ?? "Unknown error",
            lastSuccess: findLastSuccess(latestRuns, run.collector, run.store),
            action: `Check if ${run.collector} data source changed or is unavailable`,
          })
        );
      }
    }

    // Check for degraded grocery results
    if (
      run.collector === "groceries" &&
      run.status === "success" &&
      run.totalProducts !== null &&
      run.totalProducts < DEGRADED_PRODUCT_THRESHOLD
    ) {
      const issueKey = `degraded:${key}`;
      if (!alertedIssues.has(issueKey)) {
        alertedIssues.add(issueKey);
        await sendAlert(
          `Degraded Results: ${key}`,
          buildAlertHtml(
            `${key} returned only ${run.totalProducts} products (expected 25+)`,
            {
              action:
                "Check if the store website structure changed or if products are being filtered incorrectly",
            }
          )
        );
      }
    }
  }

  // Check for stale collectors
  for (const collector of staleCollectors) {
    const issueKey = `stale:${collector}`;
    if (!alertedIssues.has(issueKey)) {
      alertedIssues.add(issueKey);
      await sendAlert(
        `Stale Data: ${collector}`,
        buildAlertHtml(
          `${collector} has not had a successful run in ${STALE_THRESHOLD_DAYS}+ days`,
          {
            action: `Investigate why ${collector} collector is not completing successfully`,
          }
        )
      );
    }
  }
}

function findLastSuccess(
  runs: ScraperRun[],
  collector: string,
  store: string | null
): string {
  const match = runs.find(
    (r) =>
      r.collector === collector && r.store === store && r.status === "success"
  );
  if (match) {
    const days = Math.floor(
      (Date.now() - new Date(match.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return `${match.createdAt} (${days} day${days === 1 ? "" : "s"} ago)`;
  }
  return "Never";
}
