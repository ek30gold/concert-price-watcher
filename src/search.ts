import type { ConcertEvent, SearchQuery, UnifiedEvent } from "./types.js";

export interface EventSearcher {
  search(q: SearchQuery): Promise<ConcertEvent[]>;
}

/** Lowercase, strip punctuation and filler words so "Madison Square Garden" == "Madison Sq. Garden". */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|at|sq|square|theatre|theater|arena|center|centre|hall)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Two listings are the same show when they share a local date and a normalized venue.
 * Events without a date or venue are never merged: an unmatched duplicate beats a wrong merge.
 */
export function matchKey(e: ConcertEvent): string | null {
  if (!e.localDate || !e.venue) return null;
  return `${e.localDate}|${normalizeText(e.venue)}`;
}

export function unify(events: ConcertEvent[]): UnifiedEvent[] {
  const groups = new Map<string, ConcertEvent[]>();
  for (const e of events) {
    const key = matchKey(e) ?? `${e.source}:${e.id}`;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }
  const out: UnifiedEvent[] = [];
  for (const [key, sources] of groups) {
    const first = sources[0]!;
    const priced = sources.filter((s) => s.lowestPrice !== null);
    const best = priced.sort((a, b) => a.lowestPrice! - b.lowestPrice!)[0];
    out.push({
      key,
      name: first.name,
      venue: first.venue,
      city: first.city,
      localDate: first.localDate,
      localTime: sources.find((s) => s.localTime)?.localTime ?? null,
      sources,
      lowest: best
        ? { price: best.lowestPrice!, source: best.source, priceKind: best.priceKind, url: best.url }
        : null,
    });
  }
  return out.sort((a, b) => (a.localDate ?? "9999").localeCompare(b.localDate ?? "9999"));
}

export interface SearchResult {
  events: UnifiedEvent[];
  /** Providers that failed, with the reason. The rest of the results are still returned. */
  errors: { provider: string; message: string }[];
}

export async function searchAll(
  providers: Record<string, EventSearcher>,
  q: SearchQuery,
): Promise<SearchResult> {
  const names = Object.keys(providers);
  const settled = await Promise.allSettled(names.map((n) => providers[n]!.search(q)));
  const events: ConcertEvent[] = [];
  const errors: SearchResult["errors"] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") events.push(...r.value);
    else errors.push({ provider: names[i]!, message: String((r.reason as Error)?.message ?? r.reason) });
  });
  return { events: unify(events), errors };
}
