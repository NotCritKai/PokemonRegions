export type RegionSharePermission = "view" | "edit" | "comment";

export function createRegionShareLink(
  region: unknown,
  permission: RegionSharePermission,
  comment = "",
  response = false,
) {
  if (typeof window === "undefined") return "";

  const parts = [
    `sharedRegion=${encodeURIComponent(JSON.stringify(region))}`,
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
  return JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
}
