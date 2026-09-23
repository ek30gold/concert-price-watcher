import { readFile, writeFile } from "node:fs/promises";
import type { Snapshot } from "./types.js";

export type SnapshotStore = Record<string, Snapshot>;

export async function loadSnapshots(path: string): Promise<SnapshotStore> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as SnapshotStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

/** Stable key order so the committed file only changes when data changes. */
export async function saveSnapshots(path: string, store: SnapshotStore): Promise<void> {
  const sorted = Object.fromEntries(Object.keys(store).sort().map((k) => [k, store[k]]));
  await writeFile(path, JSON.stringify(sorted, null, 2) + "\n");
}
