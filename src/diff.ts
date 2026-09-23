import type { Snapshot, Watch } from "./types.js";

export type AlertReason = "target-crossed" | "new-low";

export interface Alert {
  watch: Watch;
  reasons: AlertReason[];
  current: Snapshot;
  previous: Snapshot | null;
}

/**
 * Decide whether a fresh snapshot deserves an email.
 * - target-crossed: price is at/below target now and was above it (or unknown) last check.
 * - new-low: price is below every price this watcher has seen before. The first-ever reading
 *   sets the baseline and does not alert on its own (otherwise every new watch emails immediately).
 * A null current price never alerts.
 */
export function evaluate(watch: Watch, current: Snapshot, previous: Snapshot | null): Alert | null {
  const now = current.lowestPrice;
  if (now === null) return null;
  const reasons: AlertReason[] = [];
  const target = watch.targetPrice;
  if (target !== undefined && now <= target) {
    const prev = previous?.lowestPrice ?? null;
    if (prev === null || prev > target) reasons.push("target-crossed");
  }
  const priorLow = previous?.allTimeLow ?? null;
  if (priorLow !== null && now < priorLow) reasons.push("new-low");
  return reasons.length ? { watch, reasons, current, previous } : null;
}

export function nextAllTimeLow(previous: Snapshot | null, price: number | null): number | null {
  const prior = previous?.allTimeLow ?? null;
  if (price === null) return prior;
  return prior === null ? price : Math.min(prior, price);
}
