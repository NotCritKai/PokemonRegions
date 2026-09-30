export type SyncCollections = {regions: unknown[]; customPokemon: unknown[]; gimmicks: unknown[]};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function decideSync(local: SyncCollections, cloud: SyncCollections, baseline: SyncCollections | null) {
  if (canonical(local) === canonical(cloud)) return "equal";
  if (!baseline) return Object.values(cloud).every(entries => entries.length === 0) ? "push" : "review";
  return canonical(cloud) === canonical(baseline) ? "push" : "review";
}
