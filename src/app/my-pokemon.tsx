import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { getPokemon, type Pokemon } from "@/api/pokemon";
import { confirmDeleteAction } from "@/utils/delete-confirmation";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

const APP_STORAGE_VERSION = "v2";
const POKEMON_STORAGE_KEY = "pokemon-team";
const CUSTOM_POKEMON_STORAGE_KEY = `custom-pokemon-options-${APP_STORAGE_VERSION}`;
const LEGACY_CUSTOM_POKEMON_STORAGE_KEY = "custom-pokemon-options";
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

type EvolutionEntry = {
  name: string;
  imageUrl: string;
  types: string[];
  stage: number;
  level: number;
  parentName: string | null;
};

type SavedPokemon = {
  name: string;
  nickname: string;
  region: string;
  notes: string;
  favorite: boolean;
  imageUrl: string;
  types: string[];
  evolutions: EvolutionEntry[];
};

type CustomPokemonEntry = {
  name: string;
  imageUrl: string;
  types: string[];
  generation: number;
  evolutions: EvolutionEntry[];
  isCustom: boolean;
  parentName: string | null;
  stage: number;
  level: number;
};

function formatPokemonName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getPokemonImageUrl(url: string) {
  const pokemonId = url.split("/").filter(Boolean).pop();
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

function getNormalizedTypes(types: string[]) {
  return Array.from(new Set(types.map((type) => type.trim()).filter(Boolean)));
}

export default function MyPokemonScreen() {
  const [savedPokemon, setSavedPokemon] = useState<SavedPokemon[]>([]);
  const [allPokemon, setAllPokemon] = useState<Pokemon[]>([]);
  const [customPokemon, setCustomPokemon] = useState<CustomPokemonEntry[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nickname, setNickname] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [hasEvolutions, setHasEvolutions] = useState(false);
  const [evolutionEntries, setEvolutionEntries] = useState<EvolutionEntry[]>([]);
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [evolutionModalVisible, setEvolutionModalVisible] = useState(false);
  const [evolutionCreateMode, setEvolutionCreateMode] = useState(false);
  const [evolutionDraftName, setEvolutionDraftName] = useState("");
  const [evolutionDraftImage, setEvolutionDraftImage] = useState("");
  const [evolutionDraftTypes, setEvolutionDraftTypes] = useState<string[]>([]);
  const [evolutionDraftStage, setEvolutionDraftStage] = useState(1);
  const [evolutionDraftLevel, setEvolutionDraftLevel] = useState(1);
  const [evolutionSelectedParent, setEvolutionSelectedParent] = useState<string | null>(null);
  const [editingEvolutionIndex, setEditingEvolutionIndex] = useState<number | null>(null);
  const [evolutionError, setEvolutionError] = useState("");
  const theme = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(POKEMON_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<SavedPokemon>[];
        setSavedPokemon(
          parsed.map((entry) => ({
            name: entry.name ?? "",
            nickname: entry.nickname ?? "",
            region: entry.region ?? "",
            notes: entry.notes ?? "",
            favorite: Boolean(entry.favorite),
            imageUrl: entry.imageUrl ?? "",
            types: Array.isArray(entry.types) ? entry.types : [],
            evolutions: Array.isArray(entry.evolutions)
              ? entry.evolutions.map((evolution) => ({
                  name: typeof evolution === "string" ? evolution : evolution?.name ?? "",
                  imageUrl: typeof evolution === "string" ? "" : evolution?.imageUrl ?? "",
                  types: typeof evolution === "string" ? [] : Array.isArray(evolution?.types) ? evolution.types : [],
                  stage: typeof evolution === "string" ? 1 : Number(evolution?.stage ?? 1),
                  level: typeof evolution === "string" ? 1 : Number(evolution?.level ?? 1),
                  parentName: typeof evolution === "string" ? null : evolution?.parentName ?? null,
                }))
              : [],
          })),
        );
      } catch {
        window.localStorage.removeItem(POKEMON_STORAGE_KEY);
      }
    }

    const storedCustom =
      window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_CUSTOM_POKEMON_STORAGE_KEY);
    if (storedCustom) {
      try {
        const parsed = JSON.parse(storedCustom) as Partial<CustomPokemonEntry>[];
        setCustomPokemon(
          parsed
            .filter((entry): entry is Partial<CustomPokemonEntry> => !!entry && typeof entry.name === "string")
            .map((entry) => ({
              name: entry.name ?? "",
              imageUrl: entry.imageUrl ?? "",
              types: Array.isArray(entry.types) ? entry.types : [],
              generation: typeof entry.generation === "number" ? entry.generation : 9,
              evolutions: Array.isArray(entry.evolutions)
                ? entry.evolutions.map((evolution) => ({
                    name: typeof evolution === "string" ? evolution : evolution?.name ?? "",
                    imageUrl: typeof evolution === "string" ? "" : evolution?.imageUrl ?? "",
                    types: typeof evolution === "string" ? [] : Array.isArray(evolution?.types) ? evolution.types : [],
                    stage: typeof evolution === "string" ? 1 : Number(evolution?.stage ?? 1),
                    level: typeof evolution === "string" ? 1 : Number(evolution?.level ?? 1),
                    parentName: typeof evolution === "string" ? null : evolution?.parentName ?? null,
                  }))
                : [],
              isCustom: true,
              parentName: typeof entry.parentName === "string" ? entry.parentName : null,
              stage: typeof entry.stage === "number" ? entry.stage : 1,
              level: typeof entry.level === "number" ? entry.level : 1,
            })),
        );
      } catch {
        window.localStorage.removeItem(CUSTOM_POKEMON_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_CUSTOM_POKEMON_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        POKEMON_STORAGE_KEY,
        JSON.stringify(savedPokemon),
      );
    }
  }, [savedPokemon]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CUSTOM_POKEMON_STORAGE_KEY,
        JSON.stringify(customPokemon),
      );
      window.localStorage.removeItem(LEGACY_CUSTOM_POKEMON_STORAGE_KEY);
    }
  }, [customPokemon]);

  useEffect(() => {
    let active = true;
    getPokemon(1025)
      .then((pokemon) => {
        if (active) setAllPokemon(pokemon);
      })
      .catch(() => {
        if (active) setAllPokemon([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredPokemon = useMemo(
    () =>
      allPokemon.filter((pokemon) =>
        pokemon.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [allPokemon, search],
  );

  const displayedPokemon = useMemo(
    () =>
      savedPokemon
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => {
          const matchesSearch =
            listSearch.trim().length === 0 ||
            `${entry.nickname} ${entry.name} ${entry.region}`
              .toLowerCase()
              .includes(listSearch.trim().toLowerCase());
          const matchesFavorite = !showFavoriteOnly || entry.favorite;
          return matchesSearch && matchesFavorite;
        })
        .sort(
          (left, right) =>
            Number(right.entry.favorite) - Number(left.entry.favorite) ||
            left.index - right.index,
        ),
    [listSearch, savedPokemon, showFavoriteOnly],
  );

  function updateEvolution(index: number, value: string) {
    setEvolutionEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, name: value } : entry,
      ),
    );
  }

  function openImagePicker(target: "main" | "evolution") {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        if (target === "main") {
          setImageUrl(result);
        } else {
          setEvolutionDraftImage(result);
        }
      };
      reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  function openEvolutionModal() {
    if (evolutionEntries.length >= 2) return;
    setEditingEvolutionIndex(null);
    setEvolutionError("");
    setEvolutionModalVisible(true);
    setEvolutionCreateMode(false);
    setEvolutionDraftName("");
    setEvolutionDraftImage("");
    setEvolutionDraftTypes([]);
    setEvolutionDraftStage(1);
    setEvolutionDraftLevel(1);
    setEvolutionSelectedParent(null);
  }

  function openEvolutionEdit(index: number) {
    const entry = evolutionEntries[index];
    if (!entry) return;
    setEditingEvolutionIndex(index);
    setEvolutionCreateMode(true);
    setEvolutionDraftName(entry.name);
    setEvolutionDraftImage(entry.imageUrl);
    setEvolutionDraftTypes(entry.types);
    setEvolutionDraftStage(entry.stage);
    setEvolutionDraftLevel(entry.level);
    setEvolutionSelectedParent(entry.parentName || selectedName || null);
    setEvolutionError("");
    setEvolutionModalVisible(true);
  }

  function removeEvolution(index: number) {
    setEvolutionEntries((current) =>
      current.filter((_, entryIndex) => entryIndex !== index),
    );
  }

  function addExistingEvolution(name: string) {
    if (evolutionEntries.length >= 2) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (
      evolutionEntries.some(
        (entry, index) => index !== editingEvolutionIndex && entry.name === trimmedName,
      )
    ) {
      setEvolutionError("Each evolution must have a unique name.");
      return;
    }
    const existingEntry = customPokemon.find((entry) => entry.name === trimmedName);
    setEvolutionEntries((current) => [
      ...current,
      {
        name: trimmedName,
        imageUrl: existingEntry?.imageUrl ?? "",
        types: existingEntry?.types ?? [],
        stage: evolutionDraftStage,
        level: evolutionDraftLevel,
        parentName: evolutionSelectedParent || selectedName || null,
      },
    ].slice(0, 2));
    setEvolutionModalVisible(false);
  }

  function saveEvolutionDraft() {
    const name = evolutionDraftName.trim();
    if (!name) {
      setEvolutionError("Enter an evolution name.");
      return;
    }
    if (!evolutionDraftLevel || evolutionDraftLevel < 1) {
      setEvolutionError("Enter the level where this Pokémon evolves.");
      return;
    }
    if (
      evolutionEntries.some(
        (entry, index) => index !== editingEvolutionIndex && entry.name === name,
      )
    ) {
      setEvolutionError("Each evolution must have a unique name.");
      return;
    }

    const entry: CustomPokemonEntry = {
      name,
      imageUrl: evolutionDraftImage.trim(),
      types: getNormalizedTypes(evolutionDraftTypes),
      generation: 9,
      evolutions: [],
      isCustom: true,
      parentName: evolutionSelectedParent || selectedName || null,
      stage: evolutionDraftStage,
      level: evolutionDraftLevel,
    };

    setCustomPokemon((current) => {
      const next =
        editingEvolutionIndex === null
          ? [...current, entry]
          : current.map((currentEntry) =>
              currentEntry.name === evolutionEntries[editingEvolutionIndex]?.name
                ? entry
                : currentEntry,
            );
      persistCustomEntries(next);
      return next;
    });
    setEvolutionEntries((current) => {
      const nextEntry = {
        name,
        imageUrl: evolutionDraftImage.trim(),
        types: getNormalizedTypes(evolutionDraftTypes),
        stage: evolutionDraftStage,
        level: evolutionDraftLevel,
        parentName: evolutionSelectedParent || selectedName || null,
      };
      if (editingEvolutionIndex === null) return [...current, nextEntry].slice(0, 2);
      return current.map((item, index) =>
        index === editingEvolutionIndex ? nextEntry : item,
      );
    });
    setEvolutionModalVisible(false);
    setEvolutionCreateMode(false);
    setEvolutionDraftName("");
    setEvolutionDraftImage("");
    setEvolutionDraftTypes([]);
    setEvolutionDraftStage(1);
    setEvolutionDraftLevel(1);
    setEvolutionSelectedParent(null);
    setEditingEvolutionIndex(null);
    setEvolutionError("");
  }

  function openCreateMenu() {
    setEditingIndex(null);
    setSelectedName("");
    setImageUrl("");
    setNickname("");
    setRegion("");
    setNotes("");
    setFavorite(false);
    setSelectedTypes([]);
    setHasEvolutions(false);
    setEvolutionEntries([]);
    setSearch("");
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    const item = savedPokemon[index];
    setEditingIndex(index);
    setSelectedName(item.name);
    setImageUrl(item.imageUrl ?? "");
    setNickname(item.nickname);
    setRegion(item.region);
    setNotes(item.notes);
    setFavorite(item.favorite);
    setSelectedTypes(getNormalizedTypes(item.types));
    setHasEvolutions(item.evolutions.length > 0);
    setEvolutionEntries(item.evolutions);
    setSearch("");
    setMenuVisible(true);
  }

  function persistCustomEntries(entries: CustomPokemonEntry[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_POKEMON_STORAGE_KEY, JSON.stringify(entries));
  }

  function savePokemon() {
    const name = selectedName.trim();
    if (!name) return;

    const nextEntry: SavedPokemon = {
      name,
      nickname: nickname.trim(),
      region: region.trim(),
      notes: notes.trim(),
      favorite,
      imageUrl: imageUrl.trim(),
      types: getNormalizedTypes(selectedTypes),
      evolutions: evolutionEntries.map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        imageUrl: entry.imageUrl.trim(),
        types: getNormalizedTypes(entry.types),
        parentName: entry.parentName || name,
      })).filter((entry) => entry.name),
    };

    const customEntries: CustomPokemonEntry[] = [
      {
        name,
        imageUrl: imageUrl.trim(),
        types: getNormalizedTypes(selectedTypes),
        generation: 9,
        evolutions: nextEntry.evolutions,
        isCustom: true,
        parentName: null,
        stage: 1,
        level: 1,
      },
      ...nextEntry.evolutions.map((evolution) => ({
        name: evolution.name,
        imageUrl: evolution.imageUrl,
        types: getNormalizedTypes(evolution.types),
        generation: 9,
        evolutions: [],
        isCustom: true,
        parentName: evolution.parentName || name,
        stage: evolution.stage,
        level: evolution.level,
      })),
    ];

    // Keep the saved trainer list in sync with the newest custom data.
    if (editingIndex === null) {
      setSavedPokemon((current) => [nextEntry, ...current]);
    } else {
      setSavedPokemon((current) =>
        current.map((entry, index) =>
          index === editingIndex ? nextEntry : entry,
        ),
      );
    }

    setCustomPokemon((current) => {
      const nextCustomPokemon = [...current, ...customEntries];
      persistCustomEntries(nextCustomPokemon);
      return nextCustomPokemon;
    });

    setMenuVisible(false);
  }

  function deletePokemon(index: number) {
    if (index < 0) return;
    setSavedPokemon((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setMenuVisible(false);
  }

  function confirmDeletePokemon(index: number) {
    if (index < 0) return;

    confirmDeleteAction({
      title: "Delete Pokemon?",
      message: "This will remove it from your saved trainer list.",
      onConfirm: () => deletePokemon(index),
    });
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Pokemon</ThemedText>

      {savedPokemon.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">Don&apos;t Have A Pokemon?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDescription}>
            Track your team, favorites, notes, types, and evolution details.
          </ThemedText>
          <Pressable onPress={openCreateMenu} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.createButton}>
              <ThemedText type="smallBold">Create One Now</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      ) : (
        <View style={styles.listSection}>
          <ThemedView type="backgroundElement" style={styles.listArea}>
            <View style={styles.listControls}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setListSearch}
                placeholder="Search saved Pokémon"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.listSearch}
                value={listSearch}
              />
              <Pressable
                onPress={() => setShowFavoriteOnly((current) => !current)}
                style={({ pressed }) => [
                  styles.filterToggle,
                  showFavoriteOnly && styles.filterToggleActive,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">
                  {showFavoriteOnly ? "Favorites Only" : "Favorites Filter"}
                </ThemedText>
              </Pressable>
            </View>
            {displayedPokemon.length === 0 ? (
              <ThemedText type="small" style={styles.noResultsText}>
                No saved Pokémon match that search.
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {displayedPokemon.map(({ entry, index }) => {
                const currentPokemon = allPokemon.find((option) => option.name === entry.name);
                return (
                  <View key={`${entry.name}-${index}`} style={styles.pokemonCard}>
                    <View style={styles.pokemonRow}>
                      <View style={styles.pokemonSummary}>
                        {entry.imageUrl || (currentPokemon ? getPokemonImageUrl(currentPokemon.url) : "") ? (
                          <Image
                            source={{
                              uri: entry.imageUrl || getPokemonImageUrl(currentPokemon?.url ?? ""),
                            }}
                            style={styles.sprite}
                          />
                        ) : null}
                        <View style={styles.pokemonTextWrap}>
                          <ThemedText type="subtitle" style={styles.pokemonName}>
                            {entry.nickname || formatPokemonName(entry.name)}
                          </ThemedText>
                          <ThemedText type="small">
                            {entry.nickname ? formatPokemonName(entry.name) : ""}
                          </ThemedText>
                          {entry.types.length > 0 ? (
                            <ThemedText type="small">
                              Types: {entry.types.map((type) => formatPokemonName(type)).join(", ")}
                            </ThemedText>
                          ) : null}
                          {entry.evolutions.length > 0 ? (
                            <ThemedText type="small">
                              Evolutions: {entry.evolutions.map((evolution) => `${formatPokemonName(evolution.name)} (Stage ${evolution.stage}, Lv ${evolution.level})`).join(", ")}
                            </ThemedText>
                          ) : null}
                          {entry.region ? (
                            <ThemedText type="small">Region: {entry.region}</ThemedText>
                          ) : null}
                          {entry.notes ? (
                            <ThemedText type="small">Notes: {entry.notes}</ThemedText>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.rowActions}>
                        <Pressable
                          accessibilityLabel={`Favorite ${entry.name}`}
                          accessibilityRole="button"
                          onPress={() =>
                            setSavedPokemon((current) =>
                              current.map((pokemon, pokemonIndex) =>
                                pokemonIndex === index
                                  ? { ...pokemon, favorite: !pokemon.favorite }
                                  : pokemon,
                              ),
                            )
                          }
                          style={({ pressed }) => [
                            styles.favoriteButton,
                            entry.favorite && styles.favoriteButtonActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText type="smallBold">
                            {entry.favorite ? "★" : "☆"}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Edit ${entry.name}`}
                          accessibilityRole="button"
                          onPress={() => openEditMenu(index)}
                          style={({ pressed }) => [
                            styles.secondaryAction,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText type="smallBold">Edit</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Delete ${entry.name}`}
                          accessibilityRole="button"
                          onPress={() => confirmDeletePokemon(index)}
                          style={({ pressed }) => [
                            styles.deleteButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText type="smallBold">Delete</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
                })}
              </View>
            )}
          </ThemedView>
        </View>
      )}

      {savedPokemon.length > 0 ? (
        <Pressable
          accessibilityLabel="Add another Pokemon"
          accessibilityRole="button"
          onPress={openCreateMenu}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="subtitle">+</ThemedText>
        </Pressable>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        transparent
        visible={menuVisible}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator>
            <ThemedView type="backgroundElement" style={styles.menu}>
              <ThemedText type="subtitle" style={styles.menuTitle}>
                {editingIndex === null ? "Create A Pokemon" : "Edit Pokemon"}
              </ThemedText>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Pokemon Image?</ThemedText>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                ) : null}
                <Pressable
                  onPress={() => openImagePicker("main")}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Upload Image</ThemedText>
                </Pressable>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setImageUrl}
                  placeholder="https://example.com/pokemon.png"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  style={styles.input}
                  value={imageUrl}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Pokemon Name</ThemedText>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setSelectedName}
                  placeholder="e.g. Pyroclaw"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  style={styles.input}
                  value={selectedName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Pokemon Types</ThemedText>
                <View style={styles.typeRow}>
                  {pokemonTypes.map((type) => {
                    const active = selectedTypes.includes(type);
                    return (
                      <Pressable
                        key={type}
                        onPress={() =>
                          setSelectedTypes((current) =>
                            current.includes(type)
                              ? current.filter((entry) => entry !== type)
                              : [...current, type],
                          )
                        }
                        style={[
                          styles.typeChip,
                          active && styles.selectedDropdown,
                        ]}
                      >
                        <ThemedText type="small">
                          {formatPokemonName(type)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Evolution Chain</ThemedText>
                <Pressable
                  onPress={() => setHasEvolutions((current) => !current)}
                  style={({ pressed }) => [
                    styles.favoriteToggle,
                    hasEvolutions && styles.favoriteButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    {hasEvolutions ? "Evolution Added" : "Has Evolutions?"}
                  </ThemedText>
                </Pressable>
                {hasEvolutions ? (
                  <View style={styles.evolutionList}>
                    {evolutionEntries.map((evolution, index) => (
                      <View key={`${evolution.name}-${index}`} style={styles.evolutionCard}>
                        <View style={styles.evolutionCardHeader}>
                          <View style={styles.evolutionCardDetails}>
                            <ThemedText type="smallBold">
                              {formatPokemonName(evolution.name)}
                            </ThemedText>
                            <ThemedText type="small">
                              {evolution.parentName
                                ? `Branches from ${formatPokemonName(evolution.parentName)}`
                                : "Evolution path not selected"}
                            </ThemedText>
                            <ThemedText type="small">
                              Stage: {evolution.stage} • Evolves At Level: {evolution.level}
                            </ThemedText>
                          </View>
                          <View style={styles.evolutionCardActions}>
                            <Pressable
                              onPress={() => openEvolutionEdit(index)}
                              style={styles.smallAction}
                            >
                              <ThemedText type="smallBold">Edit</ThemedText>
                            </Pressable>
                            <Pressable
                              onPress={() => removeEvolution(index)}
                              style={styles.smallDeleteAction}
                            >
                              <ThemedText type="smallBold">Remove</ThemedText>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      onPress={openEvolutionModal}
                      disabled={evolutionEntries.length >= 2}
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        evolutionEntries.length >= 2 && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        {evolutionEntries.length >= 2
                          ? "Maximum Evolutions Added"
                          : "Add Evolution"}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Nickname</ThemedText>
                <TextInput
                  placeholder="Optional"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  onChangeText={setNickname}
                  style={styles.input}
                  value={nickname}
                />
              </View>
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Region</ThemedText>
                <TextInput
                  placeholder="e.g. Kanto"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  onChangeText={setRegion}
                  style={styles.input}
                  value={region}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Notes</ThemedText>
                <TextInput
                  multiline
                  placeholder="Favorite move, personality, etc."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  onChangeText={setNotes}
                  style={styles.notesInput}
                  value={notes}
                />
              </View>

              <Pressable
                onPress={() => setFavorite((current) => !current)}
                style={({ pressed }) => [
                  styles.favoriteToggle,
                  favorite && styles.favoriteButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">
                  {favorite ? "★ Favorite" : "☆ Mark as Favorite"}
                </ThemedText>
              </Pressable>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={savePokemon}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    {editingIndex === null ? "Save Pokemon" : "Save Changes"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setMenuVisible(false)}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Close</ThemedText>
                </Pressable>
              </View>

              {editingIndex !== null && (
                <Pressable
                  onPress={() => confirmDeletePokemon(editingIndex)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    styles.deleteButtonWide,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Delete Pokemon</ThemedText>
                </Pressable>
              )}
            </ThemedView>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setEvolutionModalVisible(false)}
        transparent
        visible={evolutionModalVisible}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator>
            <ThemedView type="backgroundElement" style={styles.menu}>
              <ThemedText type="subtitle" style={styles.menuTitle}>
                Evolution
              </ThemedText>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setEvolutionCreateMode(false)}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    !evolutionCreateMode && styles.selectedDropdown,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Use Existing</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setEvolutionCreateMode(true)}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    evolutionCreateMode && styles.selectedDropdown,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Create New</ThemedText>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Evolution Path</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Choose the Pokémon this evolution branches from.
                </ThemedText>
                <View style={styles.evolutionParentOptions}>
                  {[selectedName, ...evolutionEntries.map((entry) => entry.name)]
                    .filter((name, index, names) => name && names.indexOf(name) === index)
                    .map((name) => (
                      <Pressable
                        key={name}
                        onPress={() => setEvolutionSelectedParent(name)}
                        style={[
                          styles.typeChip,
                          (evolutionSelectedParent || selectedName) === name &&
                            styles.selectedDropdown,
                        ]}
                      >
                        <ThemedText type="small">
                          {formatPokemonName(name)}
                        </ThemedText>
                      </Pressable>
                    ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Evolution Stage</ThemedText>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={(value) => setEvolutionDraftStage(Number(value || 1))}
                  placeholder="1"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  style={styles.input}
                  value={String(evolutionDraftStage)}
                />

                <ThemedText type="smallBold">Evolves At Level:</ThemedText>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={(value) => setEvolutionDraftLevel(Number(value || 1))}
                  placeholder="Level"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  style={styles.input}
                  value={String(evolutionDraftLevel)}
                />
              </View>
              {evolutionError ? (
                <ThemedText type="small" style={styles.validationError}>
                  {evolutionError}
                </ThemedText>
              ) : null}

              {!evolutionCreateMode ? (
                <ScrollView style={styles.pokemonPicker} showsVerticalScrollIndicator>
                  {customPokemon
                    .filter((pokemon) => pokemon.name !== selectedName)
                    .map((pokemon) => (
                      <Pressable
                        key={`${pokemon.name}-${pokemon.imageUrl}`}
                        onPress={() => addExistingEvolution(pokemon.name)}
                        style={styles.pokemonOption}
                      >
                        {pokemon.imageUrl ? (
                          <Image source={{ uri: pokemon.imageUrl }} style={styles.smallSprite} />
                        ) : null}
                        <ThemedText type="small">{formatPokemonName(pokemon.name)}</ThemedText>
                      </Pressable>
                    ))}
                </ScrollView>
              ) : (
                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold">Evolution Name</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setEvolutionDraftName}
                    placeholder="Evolution name"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.input}
                    value={evolutionDraftName}
                  />

                  <ThemedText type="smallBold">Pokemon Image?</ThemedText>
                  {evolutionDraftImage ? (
                    <Image source={{ uri: evolutionDraftImage }} style={styles.previewImage} />
                  ) : null}
                  <Pressable
                    onPress={() => openImagePicker("evolution")}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Upload Image</ThemedText>
                  </Pressable>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setEvolutionDraftImage}
                    placeholder="https://example.com/evolution.png"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.input}
                    value={evolutionDraftImage}
                  />

                  <ThemedText type="smallBold">Types</ThemedText>
                  <View style={styles.typeRow}>
                    {pokemonTypes.map((type) => {
                      const active = evolutionDraftTypes.includes(type);
                      return (
                        <Pressable
                          key={`${type}-evolution`}
                          onPress={() =>
                            setEvolutionDraftTypes((current) =>
                              current.includes(type)
                                ? current.filter((entry) => entry !== type)
                                : [...current, type],
                            )
                          }
                          style={[
                            styles.typeChip,
                            active && styles.selectedDropdown,
                          ]}
                        >
                          <ThemedText type="small">{formatPokemonName(type)}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    onPress={saveEvolutionDraft}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">
                      {editingEvolutionIndex === null
                        ? "Save Evolution"
                        : "Save Evolution Changes"}
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setEvolutionModalVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

function TextInputField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="rgba(255, 255, 255, 0.6)"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
    paddingTop: 32,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: "center",
    gap: 16,
    marginTop: 24,
  },
  emptyDescription: {
    maxWidth: 420,
    textAlign: "center",
    lineHeight: 22,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(60, 135, 247, 0.88)",
  },
  listSection: {
    width: "100%",
    maxWidth: 720,
    position: "relative",
  },
  listArea: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.18)",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  listControls: {
    gap: 10,
    marginBottom: 16,
  },
  noResultsText: {
    opacity: 0.7,
    marginTop: 8,
  },
  listSearch: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(120, 140, 180, 0.12)",
    color: "#ffffff",
  },
  filterToggle: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  filterToggleActive: {
    backgroundColor: "rgba(255, 203, 75, 0.35)",
  },
  list: {
    gap: 16,
  },
  pokemonCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(120, 140, 180, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  pokemonRow: {
    gap: 12,
    paddingVertical: 6,
  },
  pokemonSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sprite: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  smallSprite: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  pokemonTextWrap: {
    flex: 1,
    gap: 2,
  },
  pokemonName: {
    fontSize: 26,
    lineHeight: 32,
  },
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  secondaryAction: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  disabledButton: {
    opacity: 0.45,
  },
  deleteButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(180, 50, 50, 0.8)",
  },
  deleteButtonWide: {
    alignSelf: "stretch",
  },
  favoriteButton: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  favoriteButtonActive: {
    backgroundColor: "rgba(255, 203, 75, 0.8)",
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
  modalContent: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 12,
  },
  menu: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    gap: 16,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  menuTitle: {
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
  notesInput: {
    minHeight: 84,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
  },
  pokemonPicker: {
    maxHeight: 220,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  pokemonOption: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectedDropdown: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  evolutionList: {
    gap: 8,
  },
  evolutionParentOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  evolutionCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    gap: 4,
  },
  evolutionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  evolutionCardDetails: {
    flex: 1,
    gap: 4,
  },
  evolutionCardActions: {
    flexDirection: "row",
    gap: 6,
  },
  smallAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(60, 135, 247, 0.7)",
  },
  smallDeleteAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(180, 50, 50, 0.75)",
  },
  validationError: {
    color: "#ff8f8f",
  },
  favoriteToggle: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  closeButton: {
    minHeight: 44,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
