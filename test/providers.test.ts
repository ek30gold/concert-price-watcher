import { describe, expect, it } from "vitest";
import { SeatGeekClient } from "../src/providers/seatgeek.js";
import { TicketmasterClient } from "../src/providers/ticketmaster.js";
import tm from "./fixtures/ticketmaster-search.json";
import sg from "./fixtures/seatgeek-search.json";
import { fakeFetch } from "./helpers.js";

describe("TicketmasterClient", () => {
  it("builds a Discovery v2 music search and normalizes events", async () => {
    const f = fakeFetch({ "discovery/v2/events.json": { body: tm } });
    const client = new TicketmasterClient("TMKEY", f);
    const events = await client.search({ keyword: "phoebe", city: "New York", startDate: "2026-11-01", endDate: "2026-11-30" });

    const url = new URL(f.calls[0]!.url);
    expect(url.origin + url.pathname).toBe("https://app.ticketmaster.com/discovery/v2/events.json");
    expect(url.searchParams.get("apikey")).toBe("TMKEY");
    expect(url.searchParams.get("classificationName")).toBe("music");
    expect(url.searchParams.get("keyword")).toBe("phoebe");
    expect(url.searchParams.get("city")).toBe("New York");
    expect(url.searchParams.get("startDateTime")).toBe("2026-11-01T00:00:00Z");

    expect(events[0]).toMatchObject({
      source: "ticketmaster",
      id: "vvG1zZ9example",
      venue: "Madison Square Garden",
      city: "New York",
      localDate: "2026-11-14",
      lowestPrice: 79.5,
      priceKind: "primary-face-value",
    });
  });

  it("returns null price, not zero, when priceRanges is absent", async () => {
    const client = new TicketmasterClient("K", fakeFetch({ "events.json": { body: tm } }));
    const [, noPrice] = await client.search({});
    expect(noPrice!.lowestPrice).toBeNull();
    expect(noPrice!.priceKind).toBeNull();
  });

  it("throws on HTTP errors instead of returning empty results", async () => {
    const client = new TicketmasterClient("K", fakeFetch({ "events.json": { status: 429, body: { fault: "rate" } } }));
    await expect(client.search({})).rejects.toThrow(/Ticketmaster API 429/);
  });

  it("refuses to construct without a key", () => {
    expect(() => new TicketmasterClient("")).toThrow(/TICKETMASTER_API_KEY/);
  });
});

describe("SeatGeekClient", () => {
  it("builds a concert search with client_id and normalizes stats", async () => {
    const f = fakeFetch({ "api.seatgeek.com/2/events": { body: sg } });
    const client = new SeatGeekClient("SGID", undefined, f);
    const events = await client.search({ keyword: "phoebe", city: "New York", stateCode: "NY" });

    const url = new URL(f.calls[0]!.url);
    expect(url.searchParams.get("client_id")).toBe("SGID");
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(url.searchParams.get("taxonomies.name")).toBe("concert");
    expect(url.searchParams.get("q")).toBe("phoebe");
    expect(url.searchParams.get("venue.city")).toBe("New York");

    expect(events[0]).toMatchObject({
      source: "seatgeek",
      id: "6612345",
      localDate: "2026-11-14",
      localTime: "20:00:00",
      lowestPrice: 64,
      priceKind: "marketplace-listing",
      listingCount: 812,
    });
  });

  it("treats an empty stats object as unknown price", async () => {
    const client = new SeatGeekClient("SGID", undefined, fakeFetch({ "/2/events": { body: sg } }));
    const [, noStats] = await client.search({});
    expect(noStats!.lowestPrice).toBeNull();
    expect(noStats!.listingCount).toBeNull();
  });

  it("fetches a single event by id with the secret when provided", async () => {
    const f = fakeFetch({ "/2/events/6612345": { body: sg.events[0] } });
    const e = await new SeatGeekClient("SGID", "SECRET", f).getEvent("6612345");
    expect(new URL(f.calls[0]!.url).searchParams.get("client_secret")).toBe("SECRET");
    expect(e.lowestPrice).toBe(64);
  });
});
