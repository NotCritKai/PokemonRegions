import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";

export type AppearanceMode = "auto" | "light" | "dark";

type AppearanceContextValue = {
  mode: AppearanceMode;
  colorScheme: "light" | "dark";
  setMode: (mode: AppearanceMode) => void;
};

const APPEARANCE_STORAGE_KEY = "pokemon-regions-appearance";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function getStoredMode(): AppearanceMode {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  return stored === "light" || stored === "auto" || stored === "dark"
    ? stored
    : "dark";
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const nativeSystemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>("dark");
  const [webSystemScheme, setWebSystemScheme] = useState<"light" | "dark">(
    "dark",
  );

  useEffect(() => {
    setModeState(getStoredMode());
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemScheme = () =>
      setWebSystemScheme(mediaQuery.matches ? "dark" : "light");

    updateSystemScheme();
    mediaQuery.addEventListener?.("change", updateSystemScheme);
    return () => mediaQuery.removeEventListener?.("change", updateSystemScheme);
  }, []);

  const setMode = (nextMode: AppearanceMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextMode);
    }
  };

  const systemScheme =
    Platform.OS === "web"
      ? webSystemScheme
      : nativeSystemScheme === "dark"
        ? "dark"
        : "light";
  const colorScheme =
    mode === "auto" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const background = colorScheme === "dark" ? "#10131A" : "#F7F9FC";
    document.documentElement.style.backgroundColor = background;
    document.documentElement.style.colorScheme = colorScheme;
    document.body.style.backgroundColor = background;
    document.body.style.colorScheme = colorScheme;
  }, [colorScheme]);

  const value = useMemo(
    () => ({ mode, colorScheme, setMode }),
    [mode, colorScheme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("useAppAppearance must be used inside AppearanceProvider");
  }
  return value;
}
