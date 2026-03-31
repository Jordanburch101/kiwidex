import { bulkInsert, db } from "@workspace/db";
import { registry } from "./collectors/registry";
import { checkAndAlert, recordRun } from "./monitoring";
import { revalidateWeb } from "./revalidate";

const skipList = new Set<string>();
let backfillMode = false;
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--skip=(.+)$/);
  if (match) {
    for (const name of match[1]!.split(",")) {
      skipList.add(name.trim());
    }
  }
  if (arg === "--backfill") {
    backfillMode = true;
  }
}

console.log(`\nCollectors available: ${Object.keys(registry).join(", ")}`);
if (skipList.size > 0) {
  console.log(`Skipping: ${[...skipList].join(", ")}`);
}
if (backfillMode) {
  console.log("Backfill mode: inserting ALL historical data (no date filter)");
}
console.log("");

const RECENT_DAYS = 90;
const cutoffDate = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0]!;

let totalCollected = 0;
const summary: Record<string, { collected: number; error?: string }> = {};

for (const [name, collector] of Object.entries(registry)) {
  if (skipList.has(name)) {
    summary[name] = { collected: 0, error: "skipped" };
    continue;
  }

  console.log(`=== ${name} ===`);
  const start = Date.now();
  try {
    const results = await collector();
    const toInsert = backfillMode
      ? results
      : results.filter((r) => r.date >= cutoffDate);
    await bulkInsert(db, toInsert);
    const durationMs = Date.now() - start;
    const elapsed = (durationMs / 1000).toFixed(1);
    const skipped = results.length - toInsert.length;
    const suffix = skipped > 0 ? `, ${skipped} old skipped` : "";
    console.log(
      `  ${toInsert.length} data points collected (${elapsed}s)${suffix}\n`
    );
    summary[name] = { collected: toInsert.length };
    totalCollected += toInsert.length;

    // Groceries records its own per-store + aggregate runs in index.ts
    if (name !== "groceries") {
      await recordRun(name, results.length > 0 ? "success" : "partial", {
        totalProducts: results.length,
        durationMs,
      });
    }
  } catch (e) {
    const durationMs = Date.now() - start;
    const elapsed = (durationMs / 1000).toFixed(1);
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  FAILED (${elapsed}s): ${msg}\n`);
    summary[name] = { collected: 0, error: msg };

    if (name !== "groceries") {
      await recordRun(name, "failed", {
        error: msg,
        durationMs,
      });
    }
  }
}

if (totalCollected > 0) {
  console.log("=== Revalidating web ===");
  await revalidateWeb();
  console.log("");
}

console.log("=== Summary ===");
for (const [name, result] of Object.entries(summary)) {
  if (result.error === "skipped") {
    console.log(`  ${name}: skipped`);
  } else if (result.error) {
    console.log(`  ${name}: FAILED — ${result.error}`);
  } else {
    console.log(`  ${name}: ${result.collected} data points`);
  }
}
console.log(`\nTotal: ${totalCollected} data points collected`);

// Check for alerts after all collectors have run
console.log("\n=== Health Check ===");
try {
  await checkAndAlert();
  console.log("  Health check complete\n");
} catch (e) {
  console.error(
    `  Health check failed: ${e instanceof Error ? e.message : e}\n`
  );
}

process.exit(0);
