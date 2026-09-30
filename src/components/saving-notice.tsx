import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { hasUnsavedData, retrySaving, subscribeToSaving } from "@/utils/local-data";
import { ThemedText } from "./themed-text";

export function SavingNotice() {
  const [unsaved, setUnsaved] = useState(hasUnsavedData);
  useEffect(() => {
    const update = () => setUnsaved(hasUnsavedData());
    update();
    return subscribeToSaving(update);
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web" || !unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  if (!unsaved) return null;
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <ThemedText style={styles.text}>
        Changes could not be saved. Keep this page open and export a backup in Settings. Browser storage may be full or blocked.
      </ThemedText>
      <Pressable accessibilityRole="button" onPress={retrySaving} style={styles.button}>
        <ThemedText style={styles.text}>Retry Save</ThemedText>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: { position: "absolute", bottom: 12, left: 12, right: 12, padding: 12, gap: 8, borderRadius: 12, backgroundColor: "#6b2929", zIndex: 10000 },
  text: { color: "#ffffff", fontSize: 14, lineHeight: 20 },
  button: { alignSelf: "flex-start", padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" },
});
