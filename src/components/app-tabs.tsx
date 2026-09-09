import { useState } from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useAppAppearance, type AppearanceMode } from "@/hooks/use-app-appearance";
import {
  areDeleteConfirmationsEnabled,
  setDeleteConfirmationsEnabled,
} from "@/utils/delete-confirmation";

export default function AppTabs() {
  const { colorScheme, mode: appearanceMode, setMode: setAppearanceMode } =
    useAppAppearance();
  const colors = Colors[colorScheme];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [deleteConfirmationsEnabled, setDeletePromptState] = useState(
    areDeleteConfirmationsEnabled(),
  );

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
    <View style={styles.shell}>
      {settingsOpen ? (
        <Pressable
          accessibilityLabel="Close settings menu"
          onPress={() => setSettingsOpen(false)}
          style={styles.backdrop}
        />
      ) : null}
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.backgroundElement}
        labelStyle={{ selected: { color: colors.text } }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            src={require("@/assets/images/tabIcons/home.png")}
            renderingMode="template"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="my-regions">
          <NativeTabs.Trigger.Label>Regions</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="my-pokemon">
          <NativeTabs.Trigger.Label>Pokemon</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="my-gimmicks">
          <NativeTabs.Trigger.Label>Gimmicks</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="my-music">
          <NativeTabs.Trigger.Label>Music</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      <View style={styles.settingsContainer}>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          onPress={() => {
            setShowConfirmReset(false);
            setSettingsOpen((open) => !open);
          }}
          style={styles.settingsButton}
        >
          <Text style={[styles.settingsIcon, { color: colors.text }]}>⚙</Text>
        </Pressable>

        {settingsOpen ? (
          <View
            style={[
              styles.settingsMenu,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.backgroundSelected,
              },
            ]}
          >
            {showConfirmReset ? (
              <>
                <Text style={[styles.menuText, { color: colors.text }]}>
                  Reset all saved app data? This clears your regions,
                  Pokémon, gimmicks, music, and custom entries.
                </Text>
                <Pressable
                  onPress={resetAllSavedData}
                  style={[styles.menuButton, styles.dangerButton]}
                >
                  <Text style={[styles.menuButtonText, { color: colors.text }]}>
                    Confirm Reset
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowConfirmReset(false);
                    setSettingsOpen(false);
                  }}
                  style={styles.menuButton}
                >
                  <Text style={[styles.menuButtonText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
                  Appearance
                </Text>
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
                      <Text style={[styles.menuButtonText, { color: colors.text }]}>
                        {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => {
                    const nextValue = !deleteConfirmationsEnabled;
                    setDeletePromptState(nextValue);
                    setDeleteConfirmationsEnabled(nextValue);
                  }}
                  style={styles.menuButton}
                >
                  <Text style={[styles.menuButtonText, { color: colors.text }]}>
                    {deleteConfirmationsEnabled
                      ? "Delete Prompts: On"
                      : "Delete Prompts: Off"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowConfirmReset(true)}
                  style={[styles.menuButton, styles.dangerButton]}
                >
                  <Text style={[styles.menuButtonText, { color: colors.text }]}>
                    Reset Saved Data
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSettingsOpen(false)}
                  style={styles.menuButton}
                >
                  <Text style={[styles.menuButtonText, { color: colors.text }]}>
                    Close
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    position: "relative",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  settingsContainer: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 20,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  settingsMenu: {
    position: "absolute",
    top: 38,
    right: 0,
    width: 220,
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
  menuButtonText: {
    fontWeight: "700",
  },
  menuText: {
    paddingVertical: 6,
    textAlign: "center",
  },
  sectionLabel: {
    fontWeight: "700",
    paddingVertical: 4,
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
  settingsIcon: {
    fontSize: 18,
    lineHeight: 18,
  },
});
