import { getJson } from "../http.js";
import type { ConcertEvent, Fetcher, SearchQuery } from "../types.js";

const BASE = "https://api.seatgeek.com/2";

// Minimal slice of the SeatGeek Platform API /2/events response we rely on.
interface SgStats { lowest_price?: number | null; listing_count?: number | null }
interface SgEvent {
  id: number;
  title: string;
  url?: string;
  datetime_local?: string;
  time_tbd?: boolean;
  date_tbd?: boolean;
  venue?: { name?: string; city?: string; state?: string };
  performers?: { name?: string }[];
  stats?: SgStats | null;
}
interface SgSearchResponse { events?: SgEvent[] }

export function normalizeSeatGeek(e: SgEvent): ConcertEvent {
  // SeatGeek has been reported to omit `stats` for some API accounts; treat missing as unknown, never zero.
  const raw = e.stats?.lowest_price;
  const lowest = typeof raw === "number" && raw > 0 ? raw : null;
  const [date, time] = (e.datetime_local ?? "").split("T");
  return {
    source: "seatgeek",
    id: String(e.id),
    name: e.title,
    performers: (e.performers ?? []).map((x) => x.name).filter((n): n is string => !!n),
    venue: e.venue?.name ?? null,
    city: e.venue?.city ?? null,
    state: e.venue?.state ?? null,
    localDate: e.date_tbd || !date ? null : date,
    localTime: e.time_tbd || !time ? null : time,
    url: e.url ?? null,
    lowestPrice: lowest,
    priceKind: lowest === null ? null : "marketplace-listing",
    listingCount: typeof e.stats?.listing_count === "number" ? e.stats.listing_count : null,
  };
}

export class SeatGeekClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string | undefined = undefined,
    private readonly fetcher: Fetcher = fetch,
  ) {
    if (!clientId) throw new Error("SEATGEEK_CLIENT_ID is required for SeatGeek calls");
  }

  private auth(p: URLSearchParams): URLSearchParams {
    p.set("client_id", this.clientId);
    if (this.clientSecret) p.set("client_secret", this.clientSecret);
    return p;
  }

  async search(q: SearchQuery): Promise<ConcertEvent[]> {
    const p = new URLSearchParams({ "taxonomies.name": "concert", sort: "datetime_local.asc" });
    if (q.keyword) p.set("q", q.keyword);
    if (q.city) p.set("venue.city", q.city);
    if (q.stateCode) p.set("venue.state", q.stateCode);
    if (q.startDate) p.set("datetime_local.gte", `${q.startDate}T00:00:00`);
    if (q.endDate) p.set("datetime_local.lte", `${q.endDate}T23:59:59`);
    p.set("per_page", String(q.size ?? 20));
    const data = await getJson<SgSearchResponse>(this.fetcher, "SeatGeek", `${BASE}/events?${this.auth(p)}`);
    return (data.events ?? []).map(normalizeSeatGeek);
  }

  async getEvent(id: string): Promise<ConcertEvent> {
    const e = await getJson<SgEvent>(
      this.fetcher,
      "SeatGeek",
      `${BASE}/events/${encodeURIComponent(id)}?${this.auth(new URLSearchParams())}`,
    );
    return normalizeSeatGeek(e);
  }
}
