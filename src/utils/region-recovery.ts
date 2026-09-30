import { readLocalData, saveLocalData } from "./local-data";

export const RECOVERY_KEY = "pokemon-regions-recovery-v1";
export type RecoveryEntry<T> = {
  id: string;
  name: string;
  region: T;
  index: number;
  deletedAt: string;
  kind: "region" | "snapshot";
};

export function readRecovery<T>(): RecoveryEntry<T>[] {
  if (typeof window === "undefined") return [];
  const raw = readLocalData(RECOVERY_KEY);
  if (!raw) return [];
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.some((entry) =>
    !entry || typeof entry.id !== "string" || typeof entry.name !== "string" ||
    !Number.isInteger(entry.index) || entry.index < 0 || typeof entry.deletedAt !== "string" ||
    !["region", "snapshot"].includes(entry.kind) || !entry.region || typeof entry.region.name !== "string"
  )) throw new Error("Recovery data is invalid. Export a backup before changing saved data.");
  return entries;
}

export function saveRecovery<T>(entries: RecoveryEntry<T>[]) {
  return saveLocalData(RECOVERY_KEY, JSON.stringify(entries));
}

export function recoverRegion<T extends { name: string; recoveryId?: string; sharedLinkKey?: string; liveRoomCode?: string; temporary?: boolean }>(
  current: T[], entry: RecoveryEntry<T>,
): T[] {
  // A retry after a storage failure must never create a second recovered copy.
  if (current.some((region) => region.recoveryId === entry.id)) return current;
  const restored = { ...entry.region, recoveryId: entry.id, temporary: false };
  if (entry.kind === "snapshot") {
    // A recovery copy preserves subsequent edits to the working region.
    restored.name = `${restored.name} (Recovered)`;
    delete restored.sharedLinkKey;
    delete restored.liveRoomCode;
    return [...current, restored];
  }
  const existing = current.findIndex((region) =>
    restored.sharedLinkKey ? region.sharedLinkKey === restored.sharedLinkKey :
    restored.liveRoomCode ? region.liveRoomCode === restored.liveRoomCode : false,
  );
  if (existing >= 0) {
    if (!current[existing].temporary) return current;
    return current.map((region, index) => index === existing ? restored : region);
  }
  const next = [...current];
  next.splice(Math.min(entry.index, next.length), 0, restored);
  return next;
}
