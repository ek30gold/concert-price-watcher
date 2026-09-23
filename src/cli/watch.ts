import { providersFromEnv } from "../config.js";
import { notifierFromEnv } from "../notify/index.js";
import { loadSnapshots, saveSnapshots } from "../snapshots.js";
import { loadWatches } from "../watches.js";
import { runWatches } from "../watcher.js";

const WATCHES = process.env.WATCHES_PATH ?? "watches.json";
const SNAPSHOTS = process.env.SNAPSHOTS_PATH ?? "state/snapshots.json";

const watches = await loadWatches(WATCHES);
const active = watches.filter((w) => w.active !== false);
const providers = providersFromEnv(process.env);

if (active.length === 0) {
  console.log("No active watches in watches.json - nothing to do.");
  process.exit(0);
}
if (Object.keys(providers).length === 0) {
  console.log("No API keys set (SEATGEEK_CLIENT_ID / TICKETMASTER_API_KEY) - skipping this run.");
  process.exit(0);
}

const { notifier, to, dryRunReason } = notifierFromEnv(process.env);
if (dryRunReason) console.log(`Email in dry-run mode: ${dryRunReason}`);

const report = await runWatches(watches, await loadSnapshots(SNAPSHOTS), {
  providers,
  notifier,
  to,
  now: () => new Date(),
});
if (report.changed) await saveSnapshots(SNAPSHOTS, report.snapshots);
console.log(`Checked ${report.checked}, alerts ${report.alerts.length}, snapshot ${report.changed ? "updated" : "unchanged"}.`);
for (const p of report.problems) console.warn(`warn: ${p}`);
