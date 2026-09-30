export type CloudSaveResult = { success: boolean; error?: string; updatedAt?: number };

// Only a successful server response can advance the saved timestamp.
export function cloudSaveStatus(result: CloudSaveResult) {
  if (!result.success) return { message: `Cloud save failed: ${result.error || "Please try again."}`, savedAt: null };
  if (!Number.isFinite(result.updatedAt) || (result.updatedAt ?? 0) <= 0) {
    return { message: "The server did not confirm a save time. Please retry before clearing browser data.", savedAt: null };
  }
  return { message: "Saved to cloud.", savedAt: result.updatedAt! };
}

export function lastCloudSaveKey(userId: string) {
  return `pokemon-regions-last-cloud-save:${userId}`;
}
