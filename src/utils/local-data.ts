const pendingWrites = new Map<string, string>();
const listeners = new Set<() => void>();

export function hasUnsavedData() {
  return pendingWrites.size > 0;
}

export function subscribeToSaving(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveLocalData(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    pendingWrites.delete(key);
  } catch {
    pendingWrites.set(key, value);
  }
  listeners.forEach((listener) => listener());
  return !pendingWrites.has(key);
}

export function retrySaving() {
  for (const [key, value] of [...pendingWrites]) saveLocalData(key, value);
}

export function readLocalData(key: string) {
  if (typeof window === "undefined") return null;
  return pendingWrites.get(key) ?? window.localStorage.getItem(key);
}

export const BACKUP_KEYS = [
  "pokemon-regions-v2",
  "pokemon-regions-recovery-v1",
  "pokemon-team",
  "pokemon-gimmicks",
  "pokemon-music",
  "custom-pokemon-options-v2",
  "pokemon-regions-appearance",
  "pokemon-delete-confirmations-enabled",
] as const;

export function collectBackup() {
  const storage: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = readLocalData(key);
    if (value !== null) storage[key] = value;
  }
  return { version: 2, exportedAt: new Date().toISOString(), storage };
}

export function parseBackup(text: string): Record<string, string> {
  const backup = JSON.parse(text);
  if (backup?.version !== 2 || !backup.storage || typeof backup.storage !== "object") {
    throw new Error("Choose a backup created by Export All Data.");
  }
  const storage: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = backup.storage[key];
    if (value === undefined) continue;
    if (typeof value !== "string") throw new Error(`Invalid backup entry: ${key}`);
    if (key === "pokemon-regions-appearance") {
      if (!["auto", "light", "dark"].includes(value)) throw new Error("Invalid appearance setting.");
    } else if (key === "pokemon-delete-confirmations-enabled") {
      if (!["true", "false"].includes(value)) throw new Error("Invalid delete prompt setting.");
    } else {
      const entries = JSON.parse(value);
      if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry !== "object" || typeof entry.name !== "string")) {
        throw new Error(`Invalid saved collection: ${key}`);
      }
      for (const entry of entries) {
        if (key === "pokemon-regions-recovery-v1" && (
          typeof entry.id !== "string" || !Number.isInteger(entry.index) || entry.index < 0 ||
          typeof entry.deletedAt !== "string" || !["region", "snapshot"].includes(entry.kind) ||
          !entry.region || typeof entry.region.name !== "string"
        )) throw new Error("Invalid recovery entry.");
        const arrayFields = key === "pokemon-regions-v2"
          ? ["routeNames", "gyms", "gymDetails", "gymPokemon", "eliteFour", "eliteFourPokemon", "championPokemon", "gimmicks", "music"]
          : key === "pokemon-team" || key === "custom-pokemon-options-v2"
            ? ["types", "evolutions"] : [];
        if (arrayFields.some((field) => entry[field] !== undefined && !Array.isArray(entry[field]))) {
          throw new Error(`Invalid list in ${key}.`);
        }
        if (key === "pokemon-regions-v2") {
          for (const field of ["routePokemon", "routeDetails", "mapPositions"]) {
            if (entry[field] !== undefined && (!entry[field] || typeof entry[field] !== "object" || Array.isArray(entry[field]))) {
              throw new Error(`Invalid region content: ${field}`);
            }
          }
          for (const field of ["routeNames", "gyms", "eliteFour", "gimmicks"]) {
            if (entry[field]?.some((value: unknown) => typeof value !== "string")) {
              throw new Error(`Invalid region names: ${field}`);
            }
          }
        }
      }
    }
    storage[key] = value;
  }
  if (!Object.keys(storage).length) throw new Error("This backup contains no supported app data.");
  return storage;
}

// Preserve the previous data if any write fails (for example, storage quota).
export function restoreBackup(storage: Record<string, string>) {
  const previous = new Map<string, string | null>();
  for (const key of BACKUP_KEYS) previous.set(key, window.localStorage.getItem(key));
  try {
    for (const key of BACKUP_KEYS) window.localStorage.removeItem(key);
    for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
  } catch (error) {
    for (const key of BACKUP_KEYS) window.localStorage.removeItem(key);
    for (const [key, value] of previous) {
      if (value !== null) window.localStorage.setItem(key, value);
    }
    throw error;
  }
  pendingWrites.clear();
}
