export type RegionSharePermission = "view" | "edit" | "comment";

export function createRegionShareLink(
  region: unknown,
  permission: RegionSharePermission,
  comment = "",
  response = false,
) {
  if (typeof window === "undefined") return "";

  const shared = region && typeof region === "object"
    ? { ...region } as Record<string, unknown>
    : region;
  if (shared && typeof shared === "object") {
    for (const key of ["sharedLinkKey", "temporary", "liveRoomCode", "sharePermission", "sharedComments"]) {
      delete (shared as Record<string, unknown>)[key];
    }
  }

  const parts = [
    `sharedRegion=${encodeURIComponent(JSON.stringify(shared))}`,
    `permission=${encodeURIComponent(permission)}`,
  ];
  if (comment.trim()) parts.push(`comment=${encodeURIComponent(comment.trim())}`);
  if (response) parts.push("commentResponse=1");
  return `${window.location.origin}/my-regions?${parts.join("&")}`;
}

export function createCommentResponseLink(region: unknown, comment: string) {
  return createRegionShareLink(region, "comment", comment, true);
}

export function decodeSharedRegion(value: string) {
  // Router query parameters are already decoded; preserve literal percentages.
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = JSON.parse(decodeURIComponent(value));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid shared region.");
  }
  return parsed as Record<string, unknown>;
}
