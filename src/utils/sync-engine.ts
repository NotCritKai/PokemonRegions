import { fetchCloudData, pushCloudData, getAuthToken, getAuthUser } from "./account-sync";
import { collectBackup, readLocalData, restoreBackup, hasUnsavedData } from "./local-data";
import { saveVersion } from "./save-history";
import { canonical, decideSync, type SyncCollections } from "./sync-decision";
import { cloudSaveStatus, lastCloudSaveKey } from "./cloud-save-status";
const keys = {regions: "pokemon-regions-v2", customPokemon: "custom-pokemon-options-v2", gimmicks: "pokemon-gimmicks"} as const;
function localCollections(): SyncCollections {
  const read = (key: string) => {
    const value = JSON.parse(readLocalData(key) ?? "[]");
    if (!Array.isArray(value)) throw new Error("Local data is invalid. Cloud save cancelled.");
    return value;
  };
  return {regions: read(keys.regions), customPokemon: read(keys.customPokemon), gimmicks: read(keys.gimmicks)};
}
function storageWithCloud(cloud: SyncCollections) {
  const storage = collectBackup().storage;
  for (const key of Object.keys(keys) as (keyof typeof keys)[]) storage[keys[key]] = JSON.stringify(cloud[key]);
  return storage;
}
export async function syncAccount(mode: "auto" | "pull" | "push") {
  const account = getAuthUser(); const token = getAuthToken();
  if (!token || !account) return {message: "Saved on this device. Sign in for cloud saving."};
  const baselineKey = `pokemon-regions-cloud-baseline:${account.id}`;
  if (hasUnsavedData()) throw new Error("Local saving needs a retry before cloud sync.");
  const response = await fetchCloudData();
  if (token !== getAuthToken()) return {message: "Account changed; sync stopped."};
  if (!response.success || !response.data) throw new Error(response.error || "Cloud unavailable. Your local data is kept.");
  const remote = response.data;
  if (remote.syncProtocol !== 2) throw new Error("Safe cloud saving needs the backend update deployed. Export a backup meanwhile; local data is unchanged.");
  const cloud: SyncCollections = {regions: remote.regions, customPokemon: remote.customPokemon, gimmicks: remote.gimmicks};
  if (!Object.values(cloud).every(Array.isArray)) throw new Error("Cloud data is invalid. No changes made.");
  const local = localCollections();
  const baseline = JSON.parse(window.localStorage.getItem(baselineKey) ?? "null") as SyncCollections | null;
  const decision = decideSync(local, cloud, baseline);
  if (mode === "pull") {
    saveVersion("Before loading cloud data");
    restoreBackup(storageWithCloud(cloud));
    window.localStorage.setItem(baselineKey, JSON.stringify(cloud));
    return {message: "Cloud copy loaded.", reload: true};
  }
  if (mode === "auto" && decision === "review") return {message: "Cloud and device copies differ. Automatic saving is paused. Export a backup, then choose which copy to use. Neither copy was overwritten."};
  if (decision === "equal") {
    window.localStorage.setItem(baselineKey, JSON.stringify(cloud));
    const status = cloudSaveStatus({success: true, updatedAt: remote.updatedAt});
    if (status.savedAt) window.localStorage.setItem(lastCloudSaveKey(account.id), String(status.savedAt));
    return {message: status.message, savedAt: status.savedAt};
  }
  saveVersion("Cloud copy before replacement", storageWithCloud(cloud));
  const saved = await pushCloudData({...local, expectedUpdatedAt: remote.updatedAt});
  if (token !== getAuthToken()) return {message: "Account changed; sync stopped."};
  const status = cloudSaveStatus(saved);
  if (status.savedAt) {
    window.localStorage.setItem(baselineKey, JSON.stringify(local));
    window.localStorage.setItem(lastCloudSaveKey(account.id), String(status.savedAt));
  }
  return {message: status.message, savedAt: status.savedAt, dirty: Boolean(status.savedAt) && canonical(local) !== canonical(localCollections())};
}
