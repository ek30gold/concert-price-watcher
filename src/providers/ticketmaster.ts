import { getJson } from "../http.js";
import type { ConcertEvent, Fetcher, SearchQuery } from "../types.js";

const BASE = "https://app.ticketmaster.com/discovery/v2";

// Minimal slice of the Discovery API v2 response we rely on.
interface TmPriceRange { type?: string; currency?: string; min?: number; max?: number }
interface TmVenue { name?: string; city?: { name?: string }; state?: { stateCode?: string } }
interface TmEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  priceRanges?: TmPriceRange[];
  _embedded?: { venues?: TmVenue[]; attractions?: { name?: string }[] };
}
interface TmSearchResponse { _embedded?: { events?: TmEvent[] } }

export function normalizeTicketmaster(e: TmEvent): ConcertEvent {
  const venue = e._embedded?.venues?.[0];
  // Only USD ranges with a numeric min count; anything else is an honest null.
  const mins = (e.priceRanges ?? [])
    .filter((p) => (p.currency ?? "USD") === "USD" && typeof p.min === "number" && p.min > 0)
    .map((p) => p.min as number);
  const lowest = mins.length ? Math.min(...mins) : null;
  return {
    source: "ticketmaster",
    id: e.id,
    name: e.name,
    performers: (e._embedded?.attractions ?? []).map((a) => a.name).filter((n): n is string => !!n),
    venue: venue?.name ?? null,
    city: venue?.city?.name ?? null,
    state: venue?.state?.stateCode ?? null,
    localDate: e.dates?.start?.localDate ?? null,
    localTime: e.dates?.start?.localTime ?? null,
    url: e.url ?? null,
    lowestPrice: lowest,
    priceKind: lowest === null ? null : "primary-face-value",
    listingCount: null,
  };
}

export class TicketmasterClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
  ) {
    if (!apiKey) throw new Error("TICKETMASTER_API_KEY is required for Ticketmaster calls");
  }

  async search(q: SearchQuery): Promise<ConcertEvent[]> {
    const p = new URLSearchParams({ apikey: this.apiKey, classificationName: "music", sort: "date,asc" });
    if (q.keyword) p.set("keyword", q.keyword);
    if (q.city) p.set("city", q.city);
    if (q.stateCode) p.set("stateCode", q.stateCode);
    if (q.startDate) p.set("startDateTime", `${q.startDate}T00:00:00Z`);
    if (q.endDate) p.set("endDateTime", `${q.endDate}T23:59:59Z`);
    p.set("size", String(q.size ?? 20));
    const data = await getJson<TmSearchResponse>(this.fetcher, "Ticketmaster", `${BASE}/events.json?${p}`);
    return (data._embedded?.events ?? []).map(normalizeTicketmaster);
  }

  async getEvent(id: string): Promise<ConcertEvent> {
    const p = new URLSearchParams({ apikey: this.apiKey });
    const e = await getJson<TmEvent>(this.fetcher, "Ticketmaster", `${BASE}/events/${encodeURIComponent(id)}.json?${p}`);
    return normalizeTicketmaster(e);
  }
}
