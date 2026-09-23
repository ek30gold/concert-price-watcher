import type { Fetcher } from "./types.js";

export class ApiError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  ) {
    super(`${provider} API ${status}: ${message}`);
    this.name = "ApiError";
  }
}

/** GET JSON from an official API. Stops on any non-2xx (no retries around blocks or rate limits). */
export async function getJson<T>(fetcher: Fetcher, provider: string, url: string): Promise<T> {
  const res = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(provider, res.status, body.slice(0, 200) || res.statusText);
  }
  return (await res.json()) as T;
}

/** Remove a secret from a URL before it lands in an error or log line. */
export function redact(url: string, ...secrets: (string | undefined)[]): string {
  let out = url;
  for (const s of secrets) if (s) out = out.split(s).join("***");
  return out;
}
