import { describe, expect, it } from "vitest";
import { normalizeSeatGeek } from "../src/providers/seatgeek.js";
import { normalizeTicketmaster } from "../src/providers/ticketmaster.js";
import { normalizeText, searchAll, unify } from "../src/search.js";
import type { ConcertEvent } from "../src/types.js";
import tm from "./fixtures/ticketmaster-search.json";
import sg from "./fixtures/seatgeek-search.json";

const tmEvents = tm._embedded.events.map((e) => normalizeTicketmaster(e as never));
const sgEvents = sg.events.map((e) => normalizeSeatGeek(e as never));

describe("unify", () => {
  it("merges the same show across providers and picks the cheapest price", () => {
    const out = unify([...tmEvents, ...sgEvents]);
    const msg = out.find((e) => e.venue === "Madison Square Garden")!;
    expect(msg.sources.map((s) => s.source).sort()).toEqual(["seatgeek", "ticketmaster"]);
    expect(msg.lowest).toMatchObject({ price: 64, source: "seatgeek", priceKind: "marketplace-listing" });
  });

  it("keeps unmatched and unpriced events with lowest=null", () => {
    const out = unify([...tmEvents, ...sgEvents]);
    expect(out).toHaveLength(3);
    expect(out.find((e) => e.venue === "Bowery Ballroom")!.lowest).toBeNull();
  });

  it("never merges events missing a date or venue", () => {
    const a: ConcertEvent = { ...tmEvents[0]!, localDate: null };
    const b: ConcertEvent = { ...sgEvents[0]!, localDate: null };
    expect(unify([a, b])).toHaveLength(2);
  });

  it("sorts by date with undated events last", () => {
    const undated: ConcertEvent = { ...tmEvents[1]!, id: "x", localDate: null };
    const out = unify([undated, ...sgEvents]);
    expect(out.map((e) => e.localDate)).toEqual(["2026-11-14", "2026-12-01", null]);
  });
});

describe("normalizeText", () => {
  it("matches common venue spelling variants", () => {
    expect(normalizeText("Madison Sq. Garden")).toBe(normalizeText("The Madison Square Garden"));
    expect(normalizeText("Terminal 5 Theatre")).toBe(normalizeText("Terminal 5"));
  });
});

describe("searchAll", () => {
  it("returns results from healthy providers and reports the failed one", async () => {
    const res = await searchAll(
      {
        seatgeek: { search: async () => sgEvents },
        ticketmaster: { search: async () => { throw new Error("boom"); } },
      },
      { city: "New York" },
    );
    expect(res.events).toHaveLength(2);
    expect(res.errors).toEqual([{ provider: "ticketmaster", message: "boom" }]);
  });
});
