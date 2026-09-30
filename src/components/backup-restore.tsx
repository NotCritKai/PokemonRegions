import { BACKUP_TIME_KEY } from "@/utils/save-history";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { collectBackup, parseBackup, restoreBackup } from "@/utils/local-data";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(collectBackup(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pokemon-regions-all-data.json";
  anchor.click();
  try { window.localStorage.setItem(BACKUP_TIME_KEY, String(Date.now())); } catch { /* Export still works without reminder storage. */ }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const labels: Record<string, string> = {
  "pokemon-regions-v2": "Regions",
  "pokemon-regions-recovery-v1": "Recovery copies",
  "pokemon-team": "Pokémon",
  "pokemon-gimmicks": "Gimmicks",
  "pokemon-music": "Music",
  "custom-pokemon-options-v2": "Custom Pokémon",
};

export function BackupRestore({ buttonStyle }: { buttonStyle?: import("react-native").StyleProp<import("react-native").ViewStyle> }) {
  const [visible, setVisible] = useState(false);
  const [backup, setBackup] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");

  function chooseBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setError("");
      setBackup(null);
      setVisible(true);
      try {
        setBackup(parseBackup(await file.text()));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read this backup.");
      }
    };
    input.click();
  }

  function restore() {
    if (!backup) return;
    try {
      restoreBackup(backup);
      window.location.href = "/my-regions";
    } catch {
      setError("Restore failed. Your previous saved data was kept. Free up browser storage and try again.");
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={chooseBackup} style={buttonStyle}>
        <ThemedText type="smallBold">Restore Backup</ThemedText>
      </Pressable>
      <Modal transparent visible={visible} onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <ThemedView type="backgroundElement" style={styles.menu}>
              <ThemedText type="subtitle">Restore Backup</ThemedText>
              {backup ? (
                <>
                  <ThemedText>These collections will replace your saved app data on this device. Collections absent from the backup will be cleared. Your sign-in will stay unchanged.</ThemedText>
                  {Object.entries(backup).map(([key, value]) => (
                    <ThemedText key={key} type="small">
                      {labels[key] ? `${labels[key]}: ${JSON.parse(value).length}` : "App preference included"}
                    </ThemedText>
                  ))}
                  <Pressable onPress={downloadBackup} style={styles.button}>
                    <ThemedText type="smallBold">Back Up Current Data</ThemedText>
                  </Pressable>
                  <Pressable onPress={restore} style={styles.restore}>
                    <ThemedText type="smallBold">Replace Data and Restore</ThemedText>
                  </Pressable>
                </>
              ) : null}
              {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
              <Pressable onPress={() => setVisible(false)} style={styles.button}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 12, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  scroll: { width: "100%", maxHeight: "90%" },
  content: { alignItems: "center" },
  menu: { width: "100%", maxWidth: 480, padding: 20, gap: 14, borderRadius: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: "center", backgroundColor: "rgba(120,140,180,0.25)" },
  restore: { padding: 12, borderRadius: 8, alignItems: "center", backgroundColor: "rgba(60,135,247,0.8)" },
  error: { color: "#ff8f8f" },
});
