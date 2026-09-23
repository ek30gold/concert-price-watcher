import { describe, expect, it } from "vitest";
import { evaluate, nextAllTimeLow } from "../src/diff.js";
import type { Snapshot, Watch } from "../src/types.js";

const watch: Watch = { id: "w", label: "Show", events: [{ source: "seatgeek", id: "1" }], targetPrice: 100 };
const snap = (lowestPrice: number | null, allTimeLow: number | null): Snapshot => ({
  watchId: "w", observedAt: "2026-09-23T00:00:00Z", lowestPrice, source: "seatgeek",
  priceKind: "marketplace-listing", url: null, allTimeLow,
});

describe("evaluate", () => {
  it("first reading above target sets a baseline without alerting", () => {
    expect(evaluate(watch, snap(150, 150), null)).toBeNull();
  });
  it("first reading already under target alerts target-crossed", () => {
    expect(evaluate(watch, snap(90, 90), null)?.reasons).toEqual(["target-crossed"]);
  });
  it("crossing the target from above alerts both reasons", () => {
    expect(evaluate(watch, snap(95, 95), snap(120, 120))?.reasons).toEqual(["target-crossed", "new-low"]);
  });
  it("staying under target does not re-alert on the target", () => {
    expect(evaluate(watch, snap(95, 90), snap(95, 90))).toBeNull();
  });
  it("new all-time low alerts even without a target", () => {
    const noTarget: Watch = { ...watch, targetPrice: undefined };
    expect(evaluate(noTarget, snap(140, 140), snap(150, 150))?.reasons).toEqual(["new-low"]);
  });
  it("a bounce back down that does not beat the all-time low stays quiet", () => {
    expect(evaluate({ ...watch, targetPrice: undefined }, snap(130, 120), snap(160, 120))).toBeNull();
  });
  it("a null price never alerts", () => {
    expect(evaluate(watch, snap(null, 120), snap(120, 120))).toBeNull();
  });
  it("hitting the target exactly counts", () => {
    expect(evaluate(watch, snap(100, 100), snap(101, 101))?.reasons).toContain("target-crossed");
  });
});

describe("nextAllTimeLow", () => {
  it("tracks the minimum and ignores nulls", () => {
    expect(nextAllTimeLow(null, 50)).toBe(50);
    expect(nextAllTimeLow(snap(60, 40), 50)).toBe(40);
    expect(nextAllTimeLow(snap(60, 40), 30)).toBe(30);
    expect(nextAllTimeLow(snap(60, 40), null)).toBe(40);
  });
});
