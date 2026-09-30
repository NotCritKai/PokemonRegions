import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";

const APPEARANCE_STORAGE_KEY = "app-appearance-mode";

type AppearanceMode = "system" | "light" | "dark";

interface AppearanceContextType {
  appearance: AppearanceMode;
  colorScheme: "light" | "dark";
  updateAppearance: (mode: AppearanceMode) => void;
}

const AppearanceContext = createContext<AppearanceContextType>({
  appearance: "system",
  colorScheme: "light",
  updateAppearance: () => {},
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useNativeColorScheme() ?? "light";
  const [appearance, setAppearance] = useState<AppearanceMode>("system");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY) as AppearanceMode | null;
      if (stored) {
        setAppearance(stored);
      }
    }
  }, []);

  const updateAppearance = (nextMode: AppearanceMode) => {
    setAppearance(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextMode);
    }
  };

  const colorScheme = appearance === "system" ? systemScheme : appearance;

  return (
    <AppearanceContext.Provider value={{ appearance, colorScheme, updateAppearance }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppAppearance() {
  return useContext(AppearanceContext);
}
