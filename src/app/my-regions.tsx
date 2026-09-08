import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { getPokemon, type Pokemon } from "@/api/pokemon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

const REGIONS_STORAGE_KEY = "pokemon-regions";

type Region = {
  name: string;
  rivalName: string;
  type: string;
  routes: string;
  routeNames: string[];
  routePokemon: Record<string, RoutePokemon[]>;
};
type RoutePokemon = {
  name: string;
  percentage: string;
};
const biomes = ["Grassland", "Mountain", "Ocean", "Forest", "Desert", "Tundra"];
const routeCounts = Array.from({ length: 39 }, (_, index) => String(index + 1));
const pokemonTypes = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];
const pokemonGenerations = Array.from({ length: 9 }, (_, index) => index + 1);

function formatPokemonName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getPokemonImageUrl(url: string) {
  const pokemonId = url.split("/").filter(Boolean).pop();
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

export default function MyRegionsScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [regionName, setRegionName] = useState("");
  const [rivalName, setRivalName] = useState("");
  const [regionType, setRegionType] = useState("");
  const [routeCount, setRouteCount] = useState("");
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [hasLoadedRegions, setHasLoadedRegions] = useState(false);
  const [editingRegionIndex, setEditingRegionIndex] = useState<number | null>(
    null,
  );
  const [contentMenuVisible, setContentMenuVisible] = useState(false);
  const [contentRegionIndex, setContentRegionIndex] = useState<number | null>(
    null,
  );
  const [routeContentMenuVisible, setRouteContentMenuVisible] = useState(false);
  const [selectedRouteName, setSelectedRouteName] = useState("");
  const [selectedRoutePokemon, setSelectedRoutePokemon] = useState<
    RoutePokemon[]
  >([]);
  const [pokemonOptions, setPokemonOptions] = useState<Pokemon[]>([]);
  const [pokemonMenuIndex, setPokemonMenuIndex] = useState<number | null>(null);
  const [pokemonSearch, setPokemonSearch] = useState("");
  const [pokemonTypeFilter, setPokemonTypeFilter] = useState<string[]>([]);
  const [pokemonGenerationFilter, setPokemonGenerationFilter] = useState("");
  const [pokemonLoading, setPokemonLoading] = useState(false);
  const [percentageError, setPercentageError] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRegions = window.localStorage.getItem(REGIONS_STORAGE_KEY);
    if (storedRegions) {
      try {
        const savedRegions = JSON.parse(storedRegions) as Partial<Region>[];
        setRegions(
          savedRegions.map((region) => ({
            name: region.name ?? "",
            rivalName: region.rivalName ?? "",
            type: region.type ?? "",
            routes: region.routes ?? "",
            routeNames: region.routeNames ?? [],
            routePokemon: region.routePokemon ?? {},
          })),
        );
      } catch {
        window.localStorage.removeItem(REGIONS_STORAGE_KEY);
      }
    }
    setHasLoadedRegions(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoadedRegions) {
      window.localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(regions));
    }
  }, [hasLoadedRegions, regions]);

  useEffect(() => {
    let active = true;
    setPokemonLoading(true);
    getPokemon(1025)
      .then((pokemon) => {
        if (active) setPokemonOptions(pokemon);
      })
      .finally(() => {
        if (active) setPokemonLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function openCreateMenu() {
    setRegionName("");
    setRivalName("");
    setRegionType("");
    setRouteCount("");
    setRouteMenuVisible(false);
    setEditingRegionIndex(null);
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    const region = regions[index];
    setRegionName(region.name);
    setRivalName(region.rivalName);
    setRegionType(region.type);
    setRouteCount(region.routes);
    setRouteMenuVisible(false);
    setEditingRegionIndex(index);
    setMenuVisible(true);
  }

  function openContentMenu(index: number) {
    setContentRegionIndex(index);
    setContentMenuVisible(true);
  }

  function addRoute() {
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;

        const routeNames = region.routeNames ?? [];
        const routeLimit = Number(region.routes);
        if (!routeLimit || routeNames.length >= routeLimit) return region;

        return {
          ...region,
          routeNames: Array.from(
            { length: routeLimit },
            (_, routeIndex) =>
              routeNames[routeIndex] ?? `Route ${routeIndex + 1}`,
          ),
        };
      }),
    );
  }

  function removeRoute(routeIndex: number) {
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;

        const routeName = region.routeNames[routeIndex];
        const routePokemon = { ...region.routePokemon };
        delete routePokemon[routeName];

        return {
          ...region,
          routeNames: region.routeNames
            .filter((_, currentIndex) => currentIndex !== routeIndex)
            .map((name, currentIndex) =>
              name.startsWith("Route ") ? `Route ${currentIndex + 1}` : name,
            ),
          routePokemon,
        };
      }),
    );
  }

  function openRouteMenu(routeName: string) {
    setSelectedRouteName(routeName);
    setRouteContentMenuVisible(true);
    setSelectedRoutePokemon(
      activeContentRegion?.routePokemon?.[routeName] ?? [],
    );
    setPercentageError(false);
    setPokemonSearch("");
    setPokemonTypeFilter([]);
    setPokemonGenerationFilter("");
  }

  function createRegion() {
    const name = regionName.trim();
    if (!name) return;

    setRegions((currentRegions) => [
      ...currentRegions,
      {
        name,
        rivalName: rivalName.trim(),
        type: regionType,
        routes: routeCount,
        routeNames: [],
        routePokemon: {},
      },
    ]);
    setMenuVisible(false);
  }

  function saveRegion() {
    const name = regionName.trim();
    if (!name || editingRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === editingRegionIndex
          ? {
              name,
              rivalName: rivalName.trim(),
              type: regionType,
              routes: routeCount,
              routeNames: region.routeNames ?? [],
              routePokemon: region.routePokemon ?? {},
            }
          : region,
      ),
    );
    setMenuVisible(false);
  }

  function addPokemon() {
    setSelectedRoutePokemon((current) => [
      ...current,
      { name: "", percentage: "" },
    ]);
    setPokemonMenuIndex(null);
    setPercentageError(false);
  }

  function updateRoutePokemon(index: number, changes: Partial<RoutePokemon>) {
    setSelectedRoutePokemon((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...changes } : entry,
      ),
    );
    setPercentageError(false);
  }

  function saveRoute() {
    const total = selectedRoutePokemon.reduce(
      (sum, entry) => sum + Number(entry.percentage || 0),
      0,
    );
    if (total !== 100 || selectedRoutePokemon.some((entry) => !entry.name)) {
      setPercentageError(true);
      return;
    }

    if (contentRegionIndex === null) return;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex
          ? {
              ...region,
              routePokemon: {
                ...region.routePokemon,
                [selectedRouteName]: selectedRoutePokemon,
              },
            }
          : region,
      ),
    );
    setRouteContentMenuVisible(false);
  }

  function deleteRegion() {
    if (editingRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.filter((_, index) => index !== editingRegionIndex),
    );
    setMenuVisible(false);
  }

  const activeContentRegion =
    contentRegionIndex === null ? null : regions[contentRegionIndex];
  const activeRouteNames = activeContentRegion?.routeNames ?? [];
  const activeRouteLimit = Number(activeContentRegion?.routes);
  const canAddRoute =
    activeRouteLimit <= 0 || activeRouteNames.length < activeRouteLimit;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Regions</ThemedText>
      {regions.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">Don&apos;t Have A Region?</ThemedText>
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
        <View style={styles.regionsSection}>
          <ThemedView type="backgroundElement" style={styles.regionsArea}>
            <View style={styles.regionList}>
              {regions.map((region, index) => (
                <View key={`${region.name}-${region.rivalName}-${index}`}>
                  <View style={styles.regionRow}>
                    <ThemedText
                      type="subtitle"
                      adjustsFontSizeToFit
                      minimumFontScale={0.45}
                      numberOfLines={1}
                      style={styles.savedRegionName}
                    >
                      {region.name}
                    </ThemedText>
                    <View style={styles.regionActions}>
                      <Pressable
                        accessibilityLabel={`Edit ${region.name}`}
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
                      <Pressable
                        accessibilityLabel={`Content for ${region.name}`}
                        accessibilityRole="button"
                        onPress={() => openContentMenu(index)}
                        style={({ pressed }) => [
                          styles.contentButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText type="smallBold">Content</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ThemedView>
          <Pressable
            accessibilityLabel="Create another region"
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
              {editingRegionIndex === null
                ? "Create A Region"
                : `Edit ${regionName}`}
            </ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Region Name</ThemedText>
              <TextInput
                placeholder="e.x. The Time Region"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setRegionName}
                style={styles.input}
                value={regionName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Rival&apos;s Name</ThemedText>
              <TextInput
                placeholder="e.x. Jack"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setRivalName}
                style={styles.input}
                value={rivalName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Biome</ThemedText>
              <View style={styles.dropdownOptions}>
                {biomes.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setRegionType(type)}
                    style={[
                      styles.dropdown,
                      regionType === type && styles.selectedDropdown,
                    ]}
                  >
                    <ThemedText type="small">{type}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Number of Routes</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRouteMenuVisible((visible) => !visible)}
                style={styles.routeDropdown}
              >
                <ThemedText type="small">
                  {routeCount || "Select number of routes"}
                </ThemedText>
              </Pressable>
              {routeMenuVisible && (
                <View style={styles.routeMenu}>
                  {routeCounts.map((count) => (
                    <Pressable
                      key={count}
                      onPress={() => {
                        setRouteCount(count);
                        setRouteMenuVisible(false);
                      }}
                      style={[
                        styles.routeOption,
                        routeCount === count && styles.selectedDropdown,
                      ]}
                    >
                      <ThemedText type="small">{count}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Pressable
              onPress={editingRegionIndex === null ? createRegion : saveRegion}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">
                {editingRegionIndex === null ? "Create Region" : "Save Changes"}
              </ThemedText>
            </Pressable>

            {editingRegionIndex !== null && (
              <Pressable
                onPress={deleteRegion}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Delete Region</ThemedText>
              </Pressable>
            )}

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

      <Modal
        animationType="fade"
        onRequestClose={() => setContentMenuVisible(false)}
        transparent
        visible={contentMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.contentMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {contentRegionIndex === null
                ? "Content"
                : `Content - ${regions[contentRegionIndex]?.name ?? "Region"}`}
            </ThemedText>
            <ScrollView
              style={styles.contentRouteList}
              contentContainerStyle={styles.contentRouteContent}
              showsVerticalScrollIndicator
            >
              {activeRouteNames.map((routeName, routeIndex) => (
                <View
                  key={`${routeName}-${routeIndex}`}
                  style={styles.routeActionRow}
                >
                  <Pressable
                    accessibilityLabel={routeName}
                    accessibilityRole="button"
                    onPress={() => openRouteMenu(routeName)}
                    style={({ pressed }) => [
                      styles.routeOptionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="small">{routeName}</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove ${routeName}`}
                    accessibilityRole="button"
                    onPress={() => removeRoute(routeIndex)}
                    style={({ pressed }) => [
                      styles.removeRouteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Remove</ThemedText>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={addRoute}
              disabled={!canAddRoute}
              style={({ pressed }) => [
                styles.createMenuButton,
                !canAddRoute && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">
                {canAddRoute ? "Add All Routes" : "Route Limit Reached"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setContentMenuVisible(false)}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setRouteContentMenuVisible(false)}
        transparent
        visible={routeContentMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.routeContentMenu}>
            <ThemedText type="subtitle" style={styles.contentMenuTitle}>
              {selectedRouteName}
            </ThemedText>
            <View style={styles.pokemonFieldLabels}>
              <ThemedText type="smallBold" style={styles.pokemonLabel}>
                Pokemon
              </ThemedText>
              <ThemedText type="smallBold" style={styles.appearRateLabel}>
                Appear Rate
              </ThemedText>
            </View>
            <ScrollView
              style={styles.pokemonList}
              contentContainerStyle={styles.pokemonListContent}
              showsVerticalScrollIndicator
            >
              {selectedRoutePokemon.map((entry, index) => (
                <View key={`${entry.name}-${index}`} style={styles.pokemonRow}>
                  <Pressable
                    onPress={() =>
                      (() => {
                        setPokemonMenuIndex(
                          pokemonMenuIndex === index ? null : index,
                        );
                        setPokemonSearch("");
                      })()
                    }
                    style={styles.pokemonDropdown}
                  >
                    {entry.name ? (
                      <Image
                        source={{
                          uri: getPokemonImageUrl(
                            pokemonOptions.find(
                              (pokemon) => pokemon.name === entry.name,
                            )?.url ?? "",
                          ),
                        }}
                        style={styles.pokemonImage}
                      />
                    ) : null}
                    <ThemedText type="small">
                      {entry.name
                        ? formatPokemonName(entry.name)
                        : pokemonLoading
                          ? "Loading..."
                          : "Select Pokemon"}
                    </ThemedText>
                  </Pressable>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={(percentage) =>
                      updateRoutePokemon(index, { percentage })
                    }
                    placeholder="%"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.percentageInput}
                    value={entry.percentage}
                  />
                  {pokemonMenuIndex === index && (
                    <ScrollView style={styles.pokemonOptions}>
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={setPokemonSearch}
                        placeholder="Search Pokemon"
                        placeholderTextColor="rgba(255, 255, 255, 0.6)"
                        style={styles.pokemonSearch}
                        value={pokemonSearch}
                      />
                      <View style={styles.filterRow}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.filterPicker}
                        >
                          <Pressable
                            onPress={() => setPokemonTypeFilter([])}
                            style={[
                              styles.filterOption,
                              pokemonTypeFilter.length === 0 &&
                                styles.selectedDropdown,
                            ]}
                          >
                            <ThemedText type="small">All Types</ThemedText>
                          </Pressable>
                          {pokemonTypes.map((type) => (
                            <Pressable
                              key={type}
                              onPress={() =>
                                setPokemonTypeFilter((currentTypes) =>
                                  currentTypes.includes(type)
                                    ? currentTypes.filter(
                                        (currentType) => currentType !== type,
                                      )
                                    : [...currentTypes, type],
                                )
                              }
                              style={[
                                styles.filterOption,
                                pokemonTypeFilter.includes(type) &&
                                  styles.selectedDropdown,
                              ]}
                            >
                              <ThemedText type="small">
                                {formatPokemonName(type)}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </ScrollView>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.filterPicker}
                        >
                          <Pressable
                            onPress={() => setPokemonGenerationFilter("")}
                            style={[
                              styles.filterOption,
                              !pokemonGenerationFilter &&
                                styles.selectedDropdown,
                            ]}
                          >
                            <ThemedText type="small">
                              All Generations
                            </ThemedText>
                          </Pressable>
                          {pokemonGenerations.map((generation) => (
                            <Pressable
                              key={generation}
                              onPress={() =>
                                setPokemonGenerationFilter(String(generation))
                              }
                              style={[
                                styles.filterOption,
                                pokemonGenerationFilter ===
                                  String(generation) && styles.selectedDropdown,
                              ]}
                            >
                              <ThemedText type="small">
                                Gen {generation}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                      {pokemonOptions
                        .filter(
                          (pokemon) =>
                            pokemon.name.includes(
                              pokemonSearch.toLowerCase(),
                            ) &&
                            (pokemonTypeFilter.length === 0 ||
                              pokemonTypeFilter.every((type) =>
                                pokemon.types.includes(type),
                              )) &&
                            (!pokemonGenerationFilter ||
                              pokemon.generation ===
                                Number(pokemonGenerationFilter)),
                        )
                        .map((pokemon) => (
                          <Pressable
                            key={pokemon.name}
                            onPress={() => {
                              updateRoutePokemon(index, { name: pokemon.name });
                              setPokemonMenuIndex(null);
                              setPokemonSearch("");
                            }}
                            style={styles.pokemonOption}
                          >
                            <Image
                              source={{ uri: getPokemonImageUrl(pokemon.url) }}
                              style={styles.pokemonImage}
                            />
                            <ThemedText type="small">
                              {formatPokemonName(pokemon.name)}
                            </ThemedText>
                          </Pressable>
                        ))}
                    </ScrollView>
                  )}
                </View>
              ))}
            </ScrollView>
            {percentageError && (
              <ThemedText style={styles.percentageError}>
                Your Percentages Don&apos;t Equal 100%!
              </ThemedText>
            )}
            <Pressable
              onPress={addPokemon}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Add Pokemon</ThemedText>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable
                onPress={saveRoute}
                style={({ pressed }) => [
                  styles.createMenuButton,
                  styles.actionButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Save</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setRouteContentMenuVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  styles.actionButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </View>
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
  regionsSection: {
    width: "100%",
    maxWidth: 640,
    position: "relative",
    marginTop: 24,
  },
  regionsArea: {
    padding: 24,
    paddingTop: 72,
    borderRadius: 16,
  },
  regionName: {
    fontSize: 28,
    lineHeight: 36,
  },
  regionList: {
    gap: 20,
    marginTop: 24,
  },
  savedRegionName: {
    flex: 1,
    fontSize: 28,
    lineHeight: 36,
  },
  regionRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  regionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contentButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  routeName: {
    marginLeft: 16,
    marginTop: 8,
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 12,
  },
  menu: {
    width: "100%",
    maxWidth: 640,
    gap: 16,
    padding: 32,
    borderRadius: 16,
  },
  contentMenu: {
    width: "100%",
    maxWidth: 520,
    gap: 16,
    padding: 24,
    borderRadius: 16,
  },
  contentMenuTitle: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: "center",
  },
  contentRouteList: {
    maxHeight: 280,
  },
  contentRouteContent: {
    gap: 8,
  },
  routeOptionButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  routeActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  removeRouteButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(180, 50, 50, 0.8)",
  },
  routeContentMenu: {
    width: "100%",
    maxWidth: 1040,
    maxHeight: "92%",
    gap: 24,
    padding: 48,
    borderRadius: 28,
  },
  pokemonList: {
    maxHeight: 560,
  },
  pokemonListContent: {
    gap: 10,
  },
  pokemonRow: {
    position: "relative",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pokemonFieldLabels: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pokemonLabel: {
    flex: 1,
  },
  appearRateLabel: {
    width: 64,
    textAlign: "center",
  },
  pokemonDropdown: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  percentageInput: {
    width: 64,
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  pokemonOptions: {
    position: "relative",
    width: "100%",
    top: 0,
    left: 0,
    right: 0,
    height: 560,
    maxHeight: 560,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#212225",
  },
  pokemonSearch: {
    height: 44,
    marginBottom: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    color: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  filterRow: {
    gap: 8,
    marginBottom: 8,
  },
  filterPicker: {
    maxHeight: 42,
  },
  filterOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  pokemonOption: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  pokemonImage: {
    width: 28,
    height: 28,
  },
  percentageError: {
    color: "#ff5c5c",
    textAlign: "center",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignSelf: "stretch",
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
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
  },
  dropdown: {
    minHeight: 40,
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 136,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
  },
  dropdownOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  routeDropdown: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  routeMenu: {
    maxHeight: 180,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  routeOption: {
    width: 35,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  selectedDropdown: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  closeButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  createMenuButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  deleteButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(180, 50, 50, 0.8)",
  },
});
