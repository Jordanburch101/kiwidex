import { bulkInsert, db } from "@workspace/db";
import { registry } from "./collectors/registry";

const skipList = new Set<string>();
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--skip=(.+)$/);
  if (match) {
    for (const name of match[1]!.split(",")) {
      skipList.add(name.trim());
    }
  }
}

console.log(`\nCollectors available: ${Object.keys(registry).join(", ")}`);
if (skipList.size > 0) {
  console.log(`Skipping: ${[...skipList].join(", ")}`);
}
console.log("");

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
    await bulkInsert(db, results);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ${results.length} data points collected (${elapsed}s)\n`);
    summary[name] = { collected: results.length };
    totalCollected += results.length;
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  FAILED (${elapsed}s): ${msg}\n`);
    summary[name] = { collected: 0, error: msg };
  }
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

process.exit(0);
