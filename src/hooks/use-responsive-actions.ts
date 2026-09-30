import { useHydrated } from "./use-hydrated";
import { useWindowDimensions } from "react-native";

// Keep navigation tabs independent; this applies only to screen action groups.
export function useResponsiveActions<T extends Record<string, object>>(
  base: T,
  groups: (keyof T)[],
  children: (keyof T)[] = [],
): T {
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const phone = !hydrated || width < 600;
  const result = { ...base };
  for (const key of groups) {
    result[key] = { ...base[key], flexDirection: phone ? "column" : "row", flexWrap: phone ? "nowrap" : "wrap", ...(phone ? { alignItems: "stretch" } : {}) } as T[keyof T];
  }
  if (phone) for (const key of children) {
    result[key] = { ...base[key], flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: "auto", minWidth: 0, alignSelf: "stretch" } as T[keyof T];
  }
  return result;
}
