import type { Fetcher } from "../src/types.js";

export interface Call { url: string; init?: RequestInit }

/** Fake fetch: routes by substring, records calls, never touches the network. */
export function fakeFetch(routes: Record<string, { status?: number; body: unknown }>): Fetcher & { calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return new Response("not found", { status: 404 });
    const r = routes[hit]!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as Fetcher & { calls: Call[] };
  f.calls = calls;
  return f;
}
