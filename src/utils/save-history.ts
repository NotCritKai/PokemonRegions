import { collectBackup, parseBackup } from "./local-data";

const HISTORY_KEY = "pokemon-regions-save-history-v1";
export const BACKUP_TIME_KEY = "pokemon-regions-last-backup-export";

export type SavedVersion = {
  id: string;
  label: string;
  at: number;
  storage: Record<string, string>;
};

export function readVersions(): SavedVersion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return [];
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        typeof entry.label !== "string" ||
        !Number.isFinite(entry.at)
      ) {
        return [];
      }
      parseBackup(JSON.stringify({ version: 2, storage: entry.storage }));
    }
    return entries;
  } catch {
    return [];
  }
}

export function saveVersion(label: string, storage = collectBackup().storage) {
  if (typeof window === "undefined") return;
  const versions = readVersions();
  parseBackup(JSON.stringify({ version: 2, storage }));
  if (JSON.stringify(versions[0]?.storage) === JSON.stringify(storage)) return;
  window.localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(
      [{ id: crypto.randomUUID(), label, at: Date.now(), storage }, ...versions].slice(0, 10)
    )
  );
}
