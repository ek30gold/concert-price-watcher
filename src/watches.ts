import { readFile } from "node:fs/promises";
import type { Watch } from "./types.js";

const SOURCES = new Set(["ticketmaster", "seatgeek"]);

/** Validate watches.json strictly: a typo should fail CI, not silently skip a watch. */
export function parseWatches(raw: unknown): Watch[] {
  if (!Array.isArray(raw)) throw new Error("watches.json must be a JSON array");
  const seen = new Set<string>();
  return raw.map((w, i) => {
    const where = `watches.json[${i}]`;
    if (typeof w !== "object" || w === null) throw new Error(`${where} must be an object`);
    const o = w as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(o.id))
      throw new Error(`${where}.id must be lowercase letters, digits and dashes`);
    if (seen.has(o.id)) throw new Error(`${where}.id "${o.id}" is duplicated`);
    seen.add(o.id);
    if (typeof o.label !== "string" || !o.label.trim()) throw new Error(`${where}.label is required`);
    if (!Array.isArray(o.events) || o.events.length === 0)
      throw new Error(`${where}.events needs at least one {source, id}`);
    const events = o.events.map((e, j) => {
      const r = e as Record<string, unknown>;
      if (!SOURCES.has(String(r?.source)))
        throw new Error(`${where}.events[${j}].source must be "ticketmaster" or "seatgeek"`);
      if (typeof r.id !== "string" && typeof r.id !== "number")
        throw new Error(`${where}.events[${j}].id is required`);
      return { source: r.source as Watch["events"][number]["source"], id: String(r.id) };
    });
    if (o.targetPrice !== undefined && (typeof o.targetPrice !== "number" || o.targetPrice <= 0))
      throw new Error(`${where}.targetPrice must be a positive number`);
    if (o.active !== undefined && typeof o.active !== "boolean")
      throw new Error(`${where}.active must be true or false`);
    return {
      id: o.id,
      label: o.label,
      events,
      ...(o.targetPrice !== undefined ? { targetPrice: o.targetPrice as number } : {}),
      ...(o.active !== undefined ? { active: o.active as boolean } : {}),
    };
  });
}

export async function loadWatches(path: string): Promise<Watch[]> {
  return parseWatches(JSON.parse(await readFile(path, "utf8")));
}
