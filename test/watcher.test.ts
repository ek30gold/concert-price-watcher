import { describe, expect, it } from "vitest";
import { ConsoleNotifier } from "../src/notify/console.js";
import type { ConcertEvent, Snapshot, Watch } from "../src/types.js";
import { runWatches, type EventLookup } from "../src/watcher.js";

const base: ConcertEvent = {
  source: "seatgeek", id: "1", name: "Show", performers: [], venue: "V", city: "C", state: "NY",
  localDate: "2026-11-14", localTime: null, url: "https://seatgeek.com/e/1", lowestPrice: 80,
  priceKind: "marketplace-listing", listingCount: 10,
};
const lookup = (prices: Record<string, number | null | Error>, source: ConcertEvent["source"]): EventLookup => ({
  async getEvent(id) {
    const p = prices[id];
    if (p instanceof Error) throw p;
    return { ...base, source, id, lowestPrice: p ?? null, priceKind: p == null ? null : source === "seatgeek" ? "marketplace-listing" : "primary-face-value" };
  },
});
const now = () => new Date("2026-09-23T01:00:00Z");
const quiet = () => {};

const watch: Watch = {
  id: "show", label: "Show @ V", targetPrice: 100,
  events: [{ source: "seatgeek", id: "1" }, { source: "ticketmaster", id: "tm1" }],
};

describe("runWatches", () => {
  it("takes the cheapest source and emails on a target cross", async () => {
    const notifier = new ConsoleNotifier(quiet);
    const prior: Record<string, Snapshot> = {
      show: { watchId: "show", observedAt: "x", lowestPrice: 130, source: "seatgeek", priceKind: "marketplace-listing", url: null, allTimeLow: 130 },
    };
    const r = await runWatches([watch], prior, {
      providers: { seatgeek: lookup({ "1": 95 }, "seatgeek"), ticketmaster: lookup({ tm1: 110 }, "ticketmaster") },
      notifier, to: "me@example.com", now, log: quiet,
    });
    expect(r.alerts).toHaveLength(1);
    expect(r.snapshots.show).toMatchObject({ lowestPrice: 95, source: "seatgeek", allTimeLow: 95 });
    expect(notifier.sent[0]!.subject).toBe("Show @ V: $95.00 - at or under your $100.00 target");
    expect(notifier.sent[0]!.text).toContain("lowest SeatGeek listing");
  });

  it("leaves the snapshot untouched when the price has not moved", async () => {
    const prior: Record<string, Snapshot> = {
      show: { watchId: "show", observedAt: "old", lowestPrice: 120, source: "seatgeek", priceKind: "marketplace-listing", url: null, allTimeLow: 120 },
    };
    const r = await runWatches([{ ...watch, events: [watch.events[0]!] }], prior, {
      providers: { seatgeek: lookup({ "1": 120 }, "seatgeek") }, notifier: new ConsoleNotifier(quiet), to: null, now, log: quiet,
    });
    expect(r.changed).toBe(false);
    expect(r.snapshots.show!.observedAt).toBe("old");
  });

  it("keeps the last snapshot and reports problems when sources fail or return no price", async () => {
    const prior: Record<string, Snapshot> = {
      show: { watchId: "show", observedAt: "old", lowestPrice: 120, source: "seatgeek", priceKind: "marketplace-listing", url: null, allTimeLow: 110 },
    };
    const r = await runWatches([watch], prior, {
      providers: { seatgeek: lookup({ "1": null }, "seatgeek"), ticketmaster: lookup({ tm1: new Error("503") }, "ticketmaster") },
      notifier: new ConsoleNotifier(quiet), to: "me@example.com", now, log: quiet,
    });
    expect(r.alerts).toHaveLength(0);
    expect(r.changed).toBe(false);
    expect(r.snapshots.show!.lowestPrice).toBe(120);
    expect(r.problems).toEqual(["show: seatgeek:1 returned no price", "show: ticketmaster:tm1 failed - 503"]);
  });

  it("skips refs for unconfigured providers and says so", async () => {
    const r = await runWatches([watch], {}, {
      providers: { seatgeek: lookup({ "1": 150 }, "seatgeek") }, notifier: new ConsoleNotifier(quiet), to: null, now, log: quiet,
    });
    expect(r.problems).toEqual(["show: ticketmaster not configured, skipped ticketmaster:tm1"]);
    expect(r.snapshots.show!.lowestPrice).toBe(150);
  });

  it("skips paused watches but keeps their history, and drops deleted ones", async () => {
    const s = (id: string): Snapshot => ({ watchId: id, observedAt: "x", lowestPrice: 50, source: "seatgeek", priceKind: "marketplace-listing", url: null, allTimeLow: 50 });
    const r = await runWatches([{ ...watch, id: "paused", active: false }], { paused: s("paused"), gone: s("gone") }, {
      providers: {}, notifier: new ConsoleNotifier(quiet), to: null, now, log: quiet,
    });
    expect(r.checked).toBe(0);
    expect(Object.keys(r.snapshots)).toEqual(["paused"]);
    expect(r.changed).toBe(true);
  });
});
