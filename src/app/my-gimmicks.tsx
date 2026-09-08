import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

const GIMMICKS_STORAGE_KEY = "pokemon-gimmicks";
const REGIONS_STORAGE_KEY = "pokemon-regions";
const gimmickCategories = [
  "Transformation",
  "Battle Effect",
  "Move Mechanic",
  "Item Mechanic",
  "Ability Mechanic",
  "Other",
];
const gimmickCategorySummaries: Record<string, string> = {
  Transformation:
    "Changes a Pokémon into a different form, usually giving it a new look, type, ability, or battle strength.",
  "Battle Effect":
    "Changes the rules or conditions of a battle, affecting both sides while the effect is active.",
  "Move Mechanic":
    "Adds a special way for Pokémon to use, combine, power up, or alter their moves.",
  "Item Mechanic":
    "Uses a special held item or battle item to unlock an effect during a battle.",
  "Ability Mechanic":
    "Gives Pokémon a new ability effect or changes how an existing ability works.",
  Other:
    "A custom battle idea that does not fit one of the standard gimmick categories.",
};

type Gimmick = {
  name: string;
  category: string;
  description: string;
  regionNames: string[];
};

type StoredRegion = {
  name?: string;
};

export default function MyGimmicksScreen() {
  const [gimmicks, setGimmicks] = useState<Gimmick[]>([]);
  const [hasLoadedGimmicks, setHasLoadedGimmicks] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingGimmickIndex, setEditingGimmickIndex] = useState<
    number | null
  >(null);
  const [gimmickName, setGimmickName] = useState("");
  const [gimmickCategory, setGimmickCategory] = useState("");
  const [gimmickDescription, setGimmickDescription] = useState("");
  const [categorySummaryVisible, setCategorySummaryVisible] = useState(false);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedRegionNames, setSelectedRegionNames] = useState<string[]>([]);
  const theme = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedGimmicks = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
    if (storedGimmicks) {
      try {
        const savedGimmicks = JSON.parse(storedGimmicks) as Partial<Gimmick>[];
        setGimmicks(
          savedGimmicks.map((gimmick) => ({
            name: gimmick.name ?? "",
            category: gimmick.category ?? "",
            description: gimmick.description ?? "",
            regionNames: gimmick.regionNames ?? [],
          })),
        );
      } catch {
        window.localStorage.removeItem(GIMMICKS_STORAGE_KEY);
      }
    }
    setHasLoadedGimmicks(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoadedGimmicks) {
      window.localStorage.setItem(
        GIMMICKS_STORAGE_KEY,
        JSON.stringify(gimmicks),
      );
    }
  }, [gimmicks, hasLoadedGimmicks]);

  function loadRegions() {
    if (typeof window === "undefined") return;

    const storedRegions = window.localStorage.getItem(REGIONS_STORAGE_KEY);
    if (!storedRegions) {
      setAvailableRegions([]);
      return;
    }

    try {
      const regions = JSON.parse(storedRegions) as StoredRegion[];
      setAvailableRegions(
        Array.from(
          new Set(
            regions
              .map((region) => region.name?.trim())
              .filter((name): name is string => Boolean(name)),
          ),
        ),
      );
    } catch {
      setAvailableRegions([]);
    }
  }

  function openCreateMenu() {
    setGimmickName("");
    setGimmickCategory("");
    setGimmickDescription("");
    setCategorySummaryVisible(false);
    setSelectedRegionNames([]);
    loadRegions();
    setEditingGimmickIndex(null);
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    const gimmick = gimmicks[index];
    setGimmickName(gimmick.name);
    setGimmickCategory(gimmick.category);
    setGimmickDescription(gimmick.description);
    setCategorySummaryVisible(false);
    setSelectedRegionNames(gimmick.regionNames);
    loadRegions();
    setEditingGimmickIndex(index);
    setMenuVisible(true);
  }

  function saveGimmick() {
    const name = gimmickName.trim();
    if (!name) return;

    const gimmick = {
      name,
      category: gimmickCategory,
      description: gimmickDescription.trim(),
      regionNames: selectedRegionNames,
    };

    if (editingGimmickIndex === null) {
      setGimmicks((currentGimmicks) => [...currentGimmicks, gimmick]);
    } else {
      setGimmicks((currentGimmicks) =>
        currentGimmicks.map((currentGimmick, index) =>
          index === editingGimmickIndex ? gimmick : currentGimmick,
        ),
      );
    }
    setMenuVisible(false);
  }

  function deleteGimmick() {
    if (editingGimmickIndex === null) return;

    setGimmicks((currentGimmicks) =>
      currentGimmicks.filter((_, index) => index !== editingGimmickIndex),
    );
    setMenuVisible(false);
  }

  function toggleRegion(regionName: string) {
    setSelectedRegionNames((currentRegions) =>
      currentRegions.includes(regionName)
        ? currentRegions.filter((name) => name !== regionName)
        : [...currentRegions, regionName],
    );
  }

  function toggleAllRegions() {
    setSelectedRegionNames(
      hasSelectedAllRegions ? [] : availableRegions,
    );
  }

  function selectGimmickCategory(category: string) {
    setGimmickCategory(category);
    setCategorySummaryVisible(true);
  }

  const hasSelectedAllRegions =
    availableRegions.length > 0 &&
    availableRegions.every((regionName) =>
      selectedRegionNames.includes(regionName),
    );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Gimmicks</ThemedText>
      {gimmicks.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">
            Don&apos;t Have A Gimmick?
          </ThemedText>
          <Pressable
            onPress={openCreateMenu}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundElement" style={styles.createButton}>
              <ThemedText type="smallBold">Make One Now</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      ) : (
        <View style={styles.gimmicksSection}>
          <ThemedView type="backgroundElement" style={styles.gimmicksArea}>
            <View style={styles.gimmickList}>
              {gimmicks.map((gimmick, index) => (
                <View key={`${gimmick.name}-${index}`} style={styles.gimmickRow}>
                  <View style={styles.gimmickDetails}>
                    <View style={styles.gimmickHeading}>
                      <ThemedText
                        type="subtitle"
                        adjustsFontSizeToFit
                        minimumFontScale={0.45}
                        numberOfLines={1}
                        style={styles.gimmickName}
                      >
                        {gimmick.name}
                      </ThemedText>
                      {gimmick.category ? (
                        <ThemedText type="small" style={styles.categoryBadge}>
                          {gimmick.category}
                        </ThemedText>
                      ) : null}
                    </View>
                    {gimmick.description ? (
                      <ThemedText type="small" style={styles.description}>
                        {gimmick.description}
                      </ThemedText>
                    ) : null}
                    {gimmick.regionNames.length > 0 ? (
                      <ThemedText type="small" style={styles.regionSummary}>
                        Used in: {gimmick.regionNames.join(", ")}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityLabel={`Edit ${gimmick.name}`}
                    accessibilityRole="button"
                    onPress={() => openEditMenu(index)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <SymbolView
                      name={{ ios: "pencil", android: "edit", web: "edit" }}
                      size={20}
                      tintColor={theme.text}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </ThemedView>
          <Pressable
            accessibilityLabel="Create another gimmick"
            accessibilityRole="button"
            onPress={openCreateMenu}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="subtitle">+</ThemedText>
          </Pressable>
        </View>
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        transparent
        visible={menuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.menu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {editingGimmickIndex === null
                ? "Create A Gimmick"
                : `Edit ${gimmickName}`}
            </ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Gimmick Name</ThemedText>
              <TextInput
                placeholder="e.x. Terastallization"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setGimmickName}
                style={styles.input}
                value={gimmickName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Gimmick Category</ThemedText>
              <View style={styles.categoryOptions}>
                {gimmickCategories.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => selectGimmickCategory(category)}
                    style={[
                      styles.categoryOption,
                      gimmickCategory === category && styles.selectedOption,
                    ]}
                  >
                    <ThemedText type="small">{category}</ThemedText>
                  </Pressable>
                ))}
              </View>
              {categorySummaryVisible && gimmickCategory ? (
                <ThemedView type="backgroundElement" style={styles.categorySummary}>
                  <View style={styles.categorySummaryText}>
                    <ThemedText type="smallBold">{gimmickCategory}</ThemedText>
                    <ThemedText type="small">
                      {gimmickCategorySummaries[gimmickCategory]}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityLabel="Close category summary"
                    accessibilityRole="button"
                    onPress={() => setCategorySummaryVisible(false)}
                    style={({ pressed }) => [
                      styles.summaryCloseButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Got it</ThemedText>
                  </Pressable>
                </ThemedView>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Description</ThemedText>
              <TextInput
                multiline
                numberOfLines={4}
                placeholder="How does this gimmick work?"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setGimmickDescription}
                style={[styles.input, styles.descriptionInput]}
                textAlignVertical="top"
                value={gimmickDescription}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Use In Regions</ThemedText>
              {availableRegions.length > 0 ? (
                <>
                  <Pressable
                    onPress={toggleAllRegions}
                    style={[
                      styles.allRegionsButton,
                      hasSelectedAllRegions && styles.selectedOption,
                    ]}
                  >
                    <ThemedText type="smallBold">
                      {hasSelectedAllRegions
                        ? "Clear All Regions"
                        : "Add To All Regions"}
                    </ThemedText>
                  </Pressable>
                  <View style={styles.regionOptions}>
                    {availableRegions.map((regionName) => (
                      <Pressable
                        key={regionName}
                        onPress={() => toggleRegion(regionName)}
                        style={[
                          styles.regionOption,
                          selectedRegionNames.includes(regionName) &&
                            styles.selectedOption,
                        ]}
                      >
                        <ThemedText type="small">{regionName}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <ThemedText type="small" style={styles.noRegionsText}>
                  Create a region first to use this gimmick in it.
                </ThemedText>
              )}
            </View>

            <Pressable
              onPress={saveGimmick}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">
                {editingGimmickIndex === null ? "Create Gimmick" : "Save Changes"}
              </ThemedText>
            </Pressable>

            {editingGimmickIndex !== null ? (
              <Pressable
                onPress={deleteGimmick}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Delete Gimmick</ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setMenuVisible(false)}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 16,
    marginTop: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  gimmicksSection: {
    width: "100%",
    maxWidth: 640,
    position: "relative",
    marginTop: 24,
  },
  gimmicksArea: {
    padding: 24,
    paddingTop: 72,
    borderRadius: 16,
  },
  gimmickList: {
    gap: 20,
    marginTop: 24,
  },
  gimmickRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  gimmickDetails: {
    flex: 1,
    gap: 8,
  },
  gimmickHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gimmickName: {
    flex: 1,
    fontSize: 28,
    lineHeight: 36,
  },
  categoryBadge: {
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(60, 135, 247, 0.45)",
  },
  description: {
    opacity: 0.78,
  },
  regionSummary: {
    opacity: 0.62,
  },
  addButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  menu: {
    width: "100%",
    maxWidth: 640,
    gap: 16,
    padding: 32,
    borderRadius: 16,
  },
  menuTitle: {
    fontSize: 28,
    lineHeight: 36,
    textAlign: "center",
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  descriptionInput: {
    height: 112,
    paddingTop: 12,
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryOption: {
    minWidth: 136,
    minHeight: 40,
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  categorySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
  },
  categorySummaryText: {
    flex: 1,
    gap: 4,
  },
  summaryCloseButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  regionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allRegionsButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  regionOption: {
    minWidth: 136,
    minHeight: 40,
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  noRegionsText: {
    opacity: 0.7,
  },
  selectedOption: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  saveButton: {
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  deleteButton: {
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(180, 50, 50, 0.8)",
  },
  closeButton: {
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
