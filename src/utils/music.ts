export const MUSIC_STORAGE_KEY = "pokemon-music";

export type MusicKind = "audio" | "sheet" | "file";

export type MusicEntry = {
  name: string;
  uri: string;
  kind: MusicKind;
};

export function normalizeMusicUri(value: string): string {
  const trimmedValue = value.trim();
  const iframeSource = trimmedValue.match(
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i,
  )?.[1];
  const normalizedUri = iframeSource ?? trimmedValue;
  return /^www\./i.test(normalizedUri)
    ? `https://${normalizedUri}`
    : normalizedUri;
}

export type MusicProvider = "Noteflight" | "Flat.io";

export function getMusicProvider(uri: string): MusicProvider | null {
  try {
    const hostname = new URL(uri).hostname.toLowerCase();
    if (hostname === "noteflight.com" || hostname.endsWith(".noteflight.com")) {
      return "Noteflight";
    }
    if (hostname === "flat.io" || hostname.endsWith(".flat.io")) {
      return "Flat.io";
    }
  } catch {
    return null;
  }
  return null;
}

export function getMusicEmbedUri(uri: string): string {
  const provider = getMusicProvider(uri);
  if (!provider) return uri;

  try {
    const url = new URL(uri);
    if (provider === "Noteflight" && url.pathname.startsWith("/embed/")) {
      url.searchParams.set("app", "html5");
      url.searchParams.set("playback", "normal");
      url.searchParams.set("hidePlaybackControls", "false");
      return url.toString();
    }
    if (url.pathname.startsWith("/embed/")) {
      return uri;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const scoreId =
      url.searchParams.get("scoreId") ??
      url.searchParams.get("score_id") ??
      (segments[0] === "scores" && segments[1] === "view"
        ? segments[2]
        : segments[0] === "scores" || segments[0] === "score"
          ? segments.at(-1)
          : null);
    if (scoreId && provider === "Noteflight") {
      const embedUrl = new URL(`https://www.noteflight.com/embed/${scoreId}`);
      embedUrl.searchParams.set("app", "html5");
      embedUrl.searchParams.set("playback", "normal");
      embedUrl.searchParams.set("hidePlaybackControls", "false");
      return embedUrl.toString();
    }
    if (scoreId && provider === "Flat.io" && ["score", "sheet", "scores"].includes(segments[0])) {
      url.pathname = `/embed/${scoreId}`;
      url.search = "";
      return url.toString();
    }
  } catch {
    return uri;
  }
  return uri;
}

export function normalizeMusicEntries(value: unknown): MusicEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<MusicEntry>;
    if (typeof candidate.name !== "string" || typeof candidate.uri !== "string") {
      return [];
    }

    const normalizedUri = normalizeMusicUri(candidate.uri);
    const detectedKind: MusicKind =
      candidate.kind === "audio" ||
      candidate.kind === "sheet" ||
      candidate.kind === "file"
        ? candidate.kind
        : "file";

    return [
      {
        name: candidate.name,
        uri: normalizedUri,
        kind: getMusicProvider(normalizedUri) ? "sheet" : detectedKind,
      },
    ];
  });
}
