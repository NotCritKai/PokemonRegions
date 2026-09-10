import {
    TabList,
    TabListProps,
    Tabs,
    TabSlot,
    TabTrigger,
    TabTriggerSlotProps,
} from "expo-router/ui";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { AccountControl } from "./account-control";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useAppAppearance, type AppearanceMode } from "@/hooks/use-app-appearance";
import { useTheme } from "@/hooks/use-theme";
import {
  areDeleteConfirmationsEnabled,
  setDeleteConfirmationsEnabled,
} from "@/utils/delete-confirmation";

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const compactNavigation = width < 700;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [deleteConfirmationsEnabled, setDeletePromptState] = useState(
    areDeleteConfirmationsEnabled(),
  );
  const { mode: appearanceMode, setMode: setAppearanceMode } = useAppAppearance();

  useEffect(() => {
    function closeSettings(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeSettings);
    return () => window.removeEventListener("keydown", closeSettings);
  }, []);

  function resetAllSavedData() {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.clear();
    } catch {
      // keep reset resilient on browsers that block storage access briefly
    }

    try {
      window.sessionStorage.clear();
    } catch {
      // session storage is optional and not required for app state
    }

    window.location.reload();
  }

  return (
    <Tabs>
      {settingsOpen ? (
        <Pressable
          accessibilityLabel="Close settings menu"
          onPress={() => setSettingsOpen(false)}
          style={styles.backdrop}
        />
      ) : null}
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <CustomTabList compact={compactNavigation}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="my-regions" href="/my-regions" asChild>
            <TabButton>Regions</TabButton>
          </TabTrigger>
          <TabTrigger name="my-pokemon" href="/my-pokemon" asChild>
            <TabButton>Pokemon</TabButton>
          </TabTrigger>
          <TabTrigger name="my-gimmicks" href="/my-gimmicks" asChild>
            <TabButton>Gimmicks</TabButton>
          </TabTrigger>
          <TabTrigger name="my-music" href="/my-music" asChild>
            <TabButton>Music</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <SettingsControl
        appearanceMode={appearanceMode}
        deleteConfirmationsEnabled={deleteConfirmationsEnabled}
        resetAllSavedData={resetAllSavedData}
        setAppearanceMode={setAppearanceMode}
        setDeletePromptState={setDeletePromptState}
        setSettingsOpen={setSettingsOpen}
        setShowConfirmReset={setShowConfirmReset}
        settingsOpen={settingsOpen}
        showConfirmReset={showConfirmReset}
      />
    </Tabs>
  );
}

type SettingsControlProps = {
  appearanceMode: AppearanceMode;
  deleteConfirmationsEnabled: boolean;
  resetAllSavedData: () => void;
  setAppearanceMode: (mode: AppearanceMode) => void;
  setDeletePromptState: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setShowConfirmReset: (value: boolean) => void;
  settingsOpen: boolean;
  showConfirmReset: boolean;
};

function SettingsControl({
  appearanceMode,
  deleteConfirmationsEnabled,
  resetAllSavedData,
  setAppearanceMode,
  setDeletePromptState,
  setSettingsOpen,
  setShowConfirmReset,
  settingsOpen,
  showConfirmReset,
}: SettingsControlProps) {
  function exportAllData() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const storage: Record<string, string> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) {
        const value = window.localStorage.getItem(key);
        if (value !== null) storage[key] = value;
      }
    }
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), storage }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pokemon-regions-all-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <View style={styles.settingsContainer}>
      <AccountControl />
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={() => {
          setShowConfirmReset(false);
          setSettingsOpen(!settingsOpen);
        }}
        style={({ pressed }) => [
          styles.settingsButton,
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold" style={styles.settingsIcon}>
          ⚙
        </ThemedText>
      </Pressable>
      {settingsOpen ? (
        <ThemedView type="backgroundElement" style={styles.settingsMenu}>
          {showConfirmReset ? (
            <>
              <ThemedText type="small" style={styles.menuText}>
                Reset all saved app data? This clears your regions, Pokémon,
                gimmicks, music, and custom entries.
              </ThemedText>
              <Pressable
                onPress={resetAllSavedData}
                style={({ pressed }) => [
                  styles.menuButton,
                  styles.dangerButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Confirm Reset</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowConfirmReset(false);
                  setSettingsOpen(false);
                }}
                style={styles.menuButton}
              >
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.appearanceSection}>
                <ThemedText type="smallBold">Appearance</ThemedText>
                <View style={styles.appearanceOptions}>
                  {(["auto", "light", "dark"] as AppearanceMode[]).map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => setAppearanceMode(mode)}
                      style={[
                        styles.appearanceOption,
                        appearanceMode === mode && styles.appearanceOptionActive,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        {appearanceMode === mode ? "✓ " : ""}
                        {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={() => {
                  const nextValue = !deleteConfirmationsEnabled;
                  setDeletePromptState(nextValue);
                  setDeleteConfirmationsEnabled(nextValue);
                }}
                style={styles.menuButton}
              >
                <ThemedText type="smallBold">
                  {deleteConfirmationsEnabled ? "Delete Prompts: On" : "Delete Prompts: Off"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setShowConfirmReset(true)}
                style={[styles.menuButton, styles.dangerButton]}
              >
                <ThemedText type="smallBold">Reset Saved Data</ThemedText>
              </Pressable>
              <Pressable onPress={exportAllData} style={styles.menuButton}>
                <ThemedText type="smallBold">Export All Data</ThemedText>
              </Pressable>
              <Pressable onPress={() => setSettingsOpen(false)} style={styles.menuButton}>
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      ) : null}
    </View>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? "backgroundSelected" : "backgroundElement"}
        style={styles.tabButtonView}
      >
        <ThemedText
          type="small"
          themeColor={isFocused ? "text" : "textSecondary"}
        >
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList({
  compact,
  ...props
}: TabListProps & { compact?: boolean }) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[styles.tabListContainer, { backgroundColor: theme.background }]}
    >
      <ThemedView
        type="background"
        style={[styles.innerContainer, compact && styles.compactInnerContainer]}
      >
        <ThemedText type="smallBold" style={styles.brandText}>
          Pokemon Regions
        </ThemedText>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "100%",
    padding: Spacing.three,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor: "#808080",
  },
  tabSlot: {
    flex: 1,
    paddingTop: 84,
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  compactInnerContainer: {
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  brandText: {
    marginRight: 0,
    letterSpacing: 0.4,
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  settingsContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsButton: {
    width: 34,
    height: 34,
    marginLeft: Spacing.one,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  settingsMenu: {
    position: "absolute",
    top: 42,
    right: 0,
    width: 220,
    gap: 8,
    padding: 10,
    borderRadius: 12,
    zIndex: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  appearanceSection: {
    gap: 6,
    paddingBottom: 2,
  },
  appearanceOptions: {
    flexDirection: "row",
    gap: 6,
  },
  appearanceOption: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(120, 140, 180, 0.12)",
  },
  appearanceOptionActive: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  menuButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dangerButton: {
    backgroundColor: "rgba(196, 77, 77, 0.8)",
  },
  menuText: {
    paddingVertical: 6,
    textAlign: "center",
  },
  settingsIcon: {
    fontSize: 18,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
