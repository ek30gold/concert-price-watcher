import { evaluate, nextAllTimeLow, type Alert } from "./diff.js";
import { formatAlert } from "./format.js";
import type { Notifier } from "./notify/index.js";
import type { SnapshotStore } from "./snapshots.js";
import type { ConcertEvent, EventRef, Snapshot, Source, Watch } from "./types.js";

export interface EventLookup {
  getEvent(id: string): Promise<ConcertEvent>;
}

export interface RunDeps {
  /** Only configured providers are present. A watch ref for a missing provider is skipped and reported. */
  providers: Partial<Record<Source, EventLookup>>;
  notifier: Notifier;
  to: string | null;
  now: () => Date;
  log?: (s: string) => void;
}

export interface RunReport {
  checked: number;
  alerts: Alert[];
  changed: boolean;
  problems: string[];
  snapshots: SnapshotStore;
}

/** Cheapest non-null price across a watch's provider refs. */
async function priceWatch(watch: Watch, deps: RunDeps, problems: string[]) {
  let best: { e: ConcertEvent } | null = null;
  for (const ref of watch.events) {
    const client = deps.providers[ref.source];
    if (!client) {
      problems.push(`${watch.id}: ${ref.source} not configured, skipped ${ref.source}:${ref.id}`);
      continue;
    }
    try {
      const e = await client.getEvent(ref.id);
      if (e.lowestPrice === null) problems.push(`${watch.id}: ${label(ref)} returned no price`);
      else if (!best || e.lowestPrice < best.e.lowestPrice!) best = { e };
    } catch (err) {
      problems.push(`${watch.id}: ${label(ref)} failed - ${(err as Error).message}`);
    }
  }
  return best?.e ?? null;
}

const label = (r: EventRef) => `${r.source}:${r.id}`;

/** Pass every watch, paused ones included, so their snapshot history is kept. */
export async function runWatches(watches: Watch[], prior: SnapshotStore, deps: RunDeps): Promise<RunReport> {
  const log = deps.log ?? console.log;
  const snapshots: SnapshotStore = { ...prior };
  const alerts: Alert[] = [];
  const problems: string[] = [];
  let changed = false;
  let checked = 0;

  for (const watch of watches) {
    if (watch.active === false) continue;
    checked++;
    const previous = prior[watch.id] ?? null;
    const e = await priceWatch(watch, deps, problems);
    const price = e?.lowestPrice ?? null;
    // Keep the last known price when every source fails or returns null; don't record a fake drop.
    if (price === null) {
      log(`${watch.id}: no price this run (kept previous snapshot)`);
      continue;
    }
    const current: Snapshot = {
      watchId: watch.id,
      observedAt: deps.now().toISOString(),
      lowestPrice: price,
      source: e!.source,
      priceKind: e!.priceKind,
      url: e!.url,
      allTimeLow: nextAllTimeLow(previous, price),
    };
    const alert = evaluate(watch, current, previous);
    const same = previous && previous.lowestPrice === price && previous.source === current.source;
    if (!same) {
      snapshots[watch.id] = current;
      changed = true;
    }
    log(`${watch.id}: $${price} via ${current.source}${same ? " (unchanged)" : ""}`);
    if (alert) {
      alerts.push(alert);
      if (deps.to) await deps.notifier.send(formatAlert(alert, deps.to));
      else log(`${watch.id}: alert (${alert.reasons.join(", ")}) but ALERT_EMAIL_TO is not set`);
    }
  }
  // Drop snapshots for watches that were deleted from watches.json.
  const ids = new Set(watches.map((w) => w.id));
  for (const id of Object.keys(snapshots)) {
    if (!ids.has(id)) {
      delete snapshots[id];
      changed = true;
    }
  }
  return { checked, alerts, changed, problems, snapshots };
}
