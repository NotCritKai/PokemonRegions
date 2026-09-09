import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { createElement, useEffect, useState } from "react";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { confirmDeleteAction } from "@/utils/delete-confirmation";
import {
  MUSIC_STORAGE_KEY,
  getMusicEmbedUri,
  getMusicProvider,
  normalizeMusicUri,
  normalizeMusicEntries,
  type MusicEntry,
  type MusicKind,
} from "@/utils/music";

const musicKinds: { label: string; value: MusicKind }[] = [
  { label: "Audio/Sheet Music", value: "sheet" },
  { label: "File", value: "file" },
];

function AudioPreview({ uri }: { uri: string }) {
  const [loadError, setLoadError] = useState(false);

  if (Platform.OS !== "web") return null;

  if (loadError) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        This link could not be played here. Use Open File, or edit it with a
        direct audio file link such as an MP3, WAV, or OGG URL.
      </ThemedText>
    );
  }

  return createElement("audio", {
    controls: true,
    onError: () => setLoadError(true),
    preload: "metadata",
    src: uri,
    style: { width: "100%", minHeight: 40 },
  });
}

export default function MyMusicScreen() {
  const [music, setMusic] = useState<MusicEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [kind, setKind] = useState<MusicKind>("sheet");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMusic = window.localStorage.getItem(MUSIC_STORAGE_KEY);
    if (storedMusic) {
      try {
        setMusic(normalizeMusicEntries(JSON.parse(storedMusic)));
      } catch {
        window.localStorage.removeItem(MUSIC_STORAGE_KEY);
      }
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoaded) {
      window.localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(music));
    }
  }, [hasLoaded, music]);

  function openCreateMenu() {
    setEditingIndex(null);
    setName("");
    setUri("");
    setKind("sheet");
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    const entry = music[index];
    setEditingIndex(index);
    setName(entry.name);
    setUri(entry.uri);
    setKind(getMusicProvider(entry.uri) ? "sheet" : entry.kind);
    setMenuVisible(true);
  }

  function chooseFile() {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.pdf,image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) {
        window.alert("Please choose a music file smaller than 25 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setUri(String(reader.result ?? ""));
        setKind(file.type.startsWith("audio/") ? "audio" : "sheet");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function saveMusic() {
    const trimmedName = name.trim();
    const trimmedUri = uri.trim();
    if (!trimmedName || !trimmedUri) return;

    const normalizedUri = normalizeMusicUri(trimmedUri);
    const entry = {
      name: trimmedName,
      uri: normalizedUri,
      kind: getMusicProvider(normalizedUri) ? "sheet" : kind,
    } satisfies MusicEntry;
    setMusic((currentMusic) =>
      editingIndex === null
        ? [...currentMusic, entry]
        : currentMusic.map((currentEntry, index) =>
            index === editingIndex ? entry : currentEntry,
          ),
    );
    setMenuVisible(false);
  }

  function deleteMusic() {
    if (editingIndex === null) return;
    setMusic((currentMusic) =>
      currentMusic.filter((_, index) => index !== editingIndex),
    );
    setMenuVisible(false);
  }

  function confirmDeleteMusic() {
    confirmDeleteAction({
      title: "Delete music?",
      message: "This will remove it from your saved music library.",
      onConfirm: deleteMusic,
    });
  }

  const query = search.trim().toLowerCase();
  const filteredMusic = music.filter(
    (entry) =>
      !query ||
      entry.name.toLowerCase().includes(query) ||
      entry.kind.toLowerCase().includes(query),
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        style={styles.scrollView}
      >
      <ThemedText type="title">My Music</ThemedText>
      {music.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">No Music Saved Yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDescription}>
            Save audio links, sheet music, and other music files to reuse across your regions.
          </ThemedText>
          <Pressable onPress={openCreateMenu} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.createButton}>
              <ThemedText type="smallBold">Add Music</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      ) : (
        <View style={styles.musicSection}>
          <ThemedView type="backgroundElement" style={styles.musicArea}>
            <Pressable onPress={openCreateMenu} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
            <TextInput
              autoCapitalize="none"
              onChangeText={setSearch}
              placeholder="Search music"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              style={styles.searchInput}
              value={search}
            />
            {filteredMusic.length === 0 ? (
              <ThemedText type="small" style={styles.noResultsText}>
                No music matches this search.
              </ThemedText>
            ) : (
              <View style={styles.musicList}>
                {filteredMusic.map((entry) => {
                  const originalIndex = music.indexOf(entry);
                  return (
                    <View key={`${entry.name}-${originalIndex}`} style={styles.musicRow}>
                      <View style={styles.musicDetails}>
                        <ThemedText type="subtitle" style={styles.musicName}>
                          {entry.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {entry.kind === "audio"
                            ? "Audio/Sheet Music"
                            : musicKinds.find((item) => item.value === entry.kind)?.label}
                        </ThemedText>
                        {!getMusicProvider(entry.uri) && entry.kind === "audio"
                          ? <AudioPreview uri={entry.uri} />
                          : null}
                        {Platform.OS === "web" && getMusicProvider(entry.uri)
                          ? (
                            <>
                              <ThemedText type="small" themeColor="textSecondary">
                                {getMusicProvider(entry.uri)} score player
                              </ThemedText>
                              <View style={styles.providerFrame}>
                                {createElement("iframe", {
                                  allow: "autoplay; fullscreen",
                                  allowFullScreen: true,
                                  frameBorder: "0",
                                  loading: "lazy",
                                  title: entry.name,
                                  src: getMusicEmbedUri(entry.uri),
                                  style: { width: "100%", height: 480, border: 0 },
                                })}
                              </View>
                              <ThemedText type="small" themeColor="textSecondary">
                                Use the play controls inside the embedded score. If it
                                stays blank, the score owner has disabled embedding.
                              </ThemedText>
                            </>
                          )
                          : null}
                        {Platform.OS === "web" && entry.kind === "sheet"
                          && !getMusicProvider(entry.uri)
                          ? entry.uri.toLowerCase().startsWith("data:image/")
                          ? <View style={styles.sheetPreview}>{createElement("img", { alt: entry.name, src: entry.uri, style: { maxWidth: "100%", maxHeight: 300, objectFit: "contain" } })}</View>
                          : <View style={styles.sheetPreview}>{createElement("iframe", { allow: "autoplay; fullscreen", allowFullScreen: true, title: entry.name, src: entry.uri, style: { width: "100%", height: 260, border: 0 } })}</View>
                          : null}
                        <Pressable onPress={() => void Linking.openURL(entry.uri)} style={styles.openButton}>
                          <ThemedText type="smallBold">
                            {getMusicProvider(entry.uri) ? "Open Score" : "Open File"}
                          </ThemedText>
                        </Pressable>
                      </View>
                      <Pressable onPress={() => openEditMenu(originalIndex)} style={styles.editButton}>
                        <ThemedText type="smallBold">Edit</ThemedText>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </ThemedView>
        </View>
      )}
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setMenuVisible(false)} transparent visible={menuVisible}>
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            style={styles.modalScrollView}
          >
          <ThemedView type="backgroundElement" style={styles.menu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {editingIndex === null ? "Add Music" : `Edit ${name}`}
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Music Name</ThemedText>
              <TextInput onChangeText={setName} placeholder="e.g. Route Theme" placeholderTextColor="rgba(255, 255, 255, 0.6)" style={styles.input} value={name} />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Music Type</ThemedText>
              <View style={styles.kindOptions}>
                {musicKinds.map((item) => (
                  <Pressable key={item.value} onPress={() => setKind(item.value)} style={[styles.kindOption, (kind === item.value || (item.value === "sheet" && kind === "audio")) && styles.selectedOption]}>
                    <ThemedText type="small">{item.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Website Link or File</ThemedText>
              <TextInput autoCapitalize="none" onChangeText={setUri} placeholder="https://example.com/theme.mp3" placeholderTextColor="rgba(255, 255, 255, 0.6)" style={styles.input} value={uri.startsWith("data:") ? "" : uri} />
              <Pressable onPress={chooseFile} style={styles.secondaryButton}>
                <ThemedText type="smallBold">Upload File</ThemedText>
              </Pressable>
              {uri.startsWith("data:") ? <ThemedText type="small" themeColor="textSecondary">File selected and ready to save.</ThemedText> : null}
              {getMusicProvider(uri) ? (
                <ThemedView type="backgroundElement" style={styles.providerInstructions}>
                  <ThemedText type="smallBold">
                    Enable score embedding
                  </ThemedText>
                  {getMusicProvider(uri) === "Flat.io" ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      In Flat.io, open the score and choose Share, then Embed
                      on Website. Make sure the score is shared publicly, copy
                      the embed URL, and paste it above.
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Noteflight may not show an Embed option in the editor.
                      Save the score first, make it publicly viewable, and
                      paste its normal score URL, such as
                      https://www.noteflight.com/scores/view/SCORE_ID. The
                      app will convert that URL to the embed player. If the
                      score requires login, it cannot be embedded here.
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    If the embedded player is blank, open the provider&apos;s
                    sharing settings and enable public viewing/embedding, then
                    replace the saved link with the official embed URL.
                  </ThemedText>
                </ThemedView>
              ) : null}
            </View>
            <Pressable disabled={!name.trim() || !uri.trim()} onPress={saveMusic} style={[styles.saveButton, (!name.trim() || !uri.trim()) && styles.disabledButton]}>
              <ThemedText type="smallBold">Save Music</ThemedText>
            </Pressable>
            {editingIndex !== null ? (
              <Pressable onPress={confirmDeleteMusic} style={styles.deleteButton}>
                <ThemedText type="smallBold">Delete Music</ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setMenuVisible(false)} style={styles.closeButton}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  scrollView: { width: "100%" },
  scrollContent: { alignItems: "center", paddingTop: 32, paddingBottom: 48, paddingHorizontal: 16 },
  emptyState: { alignItems: "center", gap: 16, marginTop: 24 },
  emptyDescription: { maxWidth: 420, textAlign: "center", lineHeight: 22 },
  createButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(60, 135, 247, 0.88)" },
  musicSection: { width: "100%", maxWidth: 640, marginTop: 24 },
  musicArea: { position: "relative", width: "100%", padding: 24, paddingTop: 72, borderRadius: 16, borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.18)", gap: 18, shadowColor: "#000000", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  searchInput: { minHeight: 46, borderRadius: 10, paddingHorizontal: 14, color: "#ffffff", backgroundColor: "rgba(120, 140, 180, 0.12)", borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.18)" },
  addButton: { position: "absolute", top: 8, right: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.12)" },
  noResultsText: { opacity: 0.7 },
  musicList: { gap: 16 },
  musicRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, backgroundColor: "rgba(120, 140, 180, 0.08)", borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.14)" },
  musicDetails: { flex: 1, gap: 10, minWidth: 0 },
  musicName: { fontSize: 24, lineHeight: 30 },
  openButton: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(60, 135, 247, 0.82)" },
  editButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(120, 140, 180, 0.3)" },
  providerFrame: { overflow: "hidden", borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.22)" },
  sheetPreview: { overflow: "hidden", alignItems: "center", borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.22)" },
  pressed: { opacity: 0.7 },
  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  modalScrollView: { width: "100%", maxHeight: "90%" },
  modalScrollContent: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  menu: { width: "100%", maxWidth: 640, gap: 16, padding: 28, borderRadius: 20, borderWidth: 1, borderColor: "rgba(120, 140, 180, 0.2)" },
  menuTitle: { fontSize: 28, lineHeight: 36, textAlign: "center" },
  fieldGroup: { gap: 8 },
  input: { height: 44, borderRadius: 8, paddingHorizontal: 12, color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.12)" },
  kindOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kindOption: { flexGrow: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, paddingHorizontal: 10, backgroundColor: "rgba(255, 255, 255, 0.12)" },
  selectedOption: { backgroundColor: "rgba(60, 135, 247, 0.8)" },
  secondaryButton: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: "rgba(120, 140, 180, 0.25)" },
  providerInstructions: { gap: 8, padding: 12, borderRadius: 8, backgroundColor: "rgba(60, 135, 247, 0.12)" },
  saveButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(60, 135, 247, 0.88)" },
  disabledButton: { opacity: 0.45 },
  deleteButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(196, 77, 77, 0.8)" },
  closeButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(255, 255, 255, 0.12)" },
});
