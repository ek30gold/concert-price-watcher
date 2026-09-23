import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseWatches } from "../src/watches.js";

describe("parseWatches", () => {
  it("accepts a valid watch and coerces numeric ids to strings", () => {
    const [w] = parseWatches([
      { id: "phoebe-msg", label: "Phoebe @ MSG", events: [{ source: "seatgeek", id: 6612345 }], targetPrice: 60 },
    ]);
    expect(w).toEqual({ id: "phoebe-msg", label: "Phoebe @ MSG", events: [{ source: "seatgeek", id: "6612345" }], targetPrice: 60 });
  });

  it.each([
    [{}, /must be a JSON array/],
    [[{ id: "Bad Id", label: "x", events: [{ source: "seatgeek", id: "1" }] }], /id must be/],
    [[{ id: "a", label: "x", events: [] }], /at least one/],
    [[{ id: "a", label: "x", events: [{ source: "stubhub", id: "1" }] }], /source must be/],
    [[{ id: "a", label: "x", events: [{ source: "seatgeek", id: "1" }], targetPrice: -5 }], /targetPrice/],
    [
      [
        { id: "a", label: "x", events: [{ source: "seatgeek", id: "1" }] },
        { id: "a", label: "y", events: [{ source: "seatgeek", id: "2" }] },
      ],
      /duplicated/,
    ],
  ])("rejects invalid input %#", (input, err) => {
    expect(() => parseWatches(input)).toThrow(err);
  });

  it.each(["watches.json", "watches.example.json"])("committed %s parses cleanly", async (f) => {
    const raw = JSON.parse(await readFile(new URL(`../${f}`, import.meta.url), "utf8"));
    expect(() => parseWatches(raw)).not.toThrow();
  });
});
