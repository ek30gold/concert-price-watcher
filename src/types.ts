/** Normalized shapes shared by every provider. Prices are USD; null means "the API did not say". */

export type Source = "ticketmaster" | "seatgeek";

export interface EventRef {
  source: Source;
  id: string;
}

export interface ConcertEvent {
  source: Source;
  id: string;
  name: string;
  performers: string[];
  venue: string | null;
  city: string | null;
  state: string | null;
  /** Local date at the venue, YYYY-MM-DD. */
  localDate: string | null;
  /** Local time at the venue, HH:MM[:SS], if announced. */
  localTime: string | null;
  url: string | null;
  /**
   * Lowest price the API reported. Ticketmaster: min of face-value priceRanges (primary).
   * SeatGeek: stats.lowest_price (its marketplace listings). Null when not returned.
   */
  lowestPrice: number | null;
  /** How the price was obtained, so alerts never blur face value with resale. */
  priceKind: "primary-face-value" | "marketplace-listing" | null;
  listingCount: number | null;
}

/** One event as seen across providers after matching. */
export interface UnifiedEvent {
  key: string;
  name: string;
  venue: string | null;
  city: string | null;
  localDate: string | null;
  localTime: string | null;
  sources: ConcertEvent[];
  /** Cheapest non-null price across sources, with where it came from. */
  lowest: { price: number; source: Source; priceKind: ConcertEvent["priceKind"]; url: string | null } | null;
}

export interface SearchQuery {
  /** Artist, venue, or free text. */
  keyword?: string;
  city?: string;
  /** Two-letter state code, e.g. NY. */
  stateCode?: string;
  /** Inclusive YYYY-MM-DD bounds. */
  startDate?: string;
  endDate?: string;
  size?: number;
}

export interface Watch {
  /** Stable handle you choose, e.g. "boygenius-msg". */
  id: string;
  label: string;
  /** At least one provider event ID. SeatGeek carries resale pricing; Ticketmaster adds face value. */
  events: EventRef[];
  /** Alert when the lowest price is at or below this. Optional: without it you only get new-low alerts. */
  targetPrice?: number;
  /** Set false to pause without deleting. */
  active?: boolean;
}

export interface Snapshot {
  watchId: string;
  /** When this price was first observed. Unchanged prices keep the old stamp so the file only changes on real moves. */
  observedAt: string;
  lowestPrice: number | null;
  source: Source | null;
  priceKind: ConcertEvent["priceKind"];
  url: string | null;
  /** Lowest price ever seen by this watcher, so "new low" survives a later price bounce. */
  allTimeLow: number | null;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
