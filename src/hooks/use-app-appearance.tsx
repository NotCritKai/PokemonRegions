import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";
import { useHydrated } from "./use-hydrated";

export type AppearanceMode = "auto" | "light" | "dark";
const STORAGE_KEY = "pokemon-regions-appearance";
interface AppearanceContextType {
  mode: AppearanceMode;
  colorScheme: "light" | "dark";
  setMode: (mode: AppearanceMode) => void;
}
const AppearanceContext = createContext<AppearanceContextType>({
  mode: "auto", colorScheme: "light", setMode: () => {},
});
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const nativeScheme = useNativeColorScheme();
  const systemScheme = nativeScheme === "dark" ? "dark" : "light";
  const hydrated = useHydrated();
  const [mode, setModeState] = useState<AppearanceMode>("auto");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("app-appearance-mode");
      if (stored === "light" || stored === "dark" || stored === "auto" || stored === "system") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate saved browser preference after the shared initial render.
        setModeState(stored === "system" ? "auto" : stored);
      }
    } catch { /* Browser storage can be unavailable; keep the system preference. */ }
  }, []);
  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the session preference. */ }
  };
  const colorScheme = !hydrated ? "light" : mode === "auto" ? systemScheme : mode;
  return <AppearanceContext.Provider value={{mode, colorScheme, setMode}}>{children}</AppearanceContext.Provider>;
}
export function useAppAppearance() { return useContext(AppearanceContext); }
