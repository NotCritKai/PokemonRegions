import { Image } from "expo-image";
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

const POKEMON_STORAGE_KEY = "my-pokemon";
const REGIONS_STORAGE_KEY = "pokemon-regions";

type MyPokemon = {
  species: string;
  nickname: string;
  nature: string;
  ability: string;
  heldItem: string;
  moves: string[];
  regionName: string;
};

type StoredRegion = {
  name?: string;
};

function formatPokemonName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getPokemonImageUrl(url: string) {
  const pokemonId = url.split("/").filter(Boolean).pop();
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

export default function MyPokemonScreen() {
  const [pokemon, setPokemon] = useState<MyPokemon[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<Pokemon[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [speciesMenuVisible, setSpeciesMenuVisible] = useState(false);
  const [nickname, setNickname] = useState("");
  const [nature, setNature] = useState("");
  const [ability, setAbility] = useState("");
  const [heldItem, setHeldItem] = useState("");
  const [moves, setMoves] = useState(["", "", "", ""]);
  const [regionName, setRegionName] = useState("");
  const theme = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedPokemon = window.localStorage.getItem(POKEMON_STORAGE_KEY);
    if (storedPokemon) {
      try {
        setPokemon(JSON.parse(storedPokemon) as MyPokemon[]);
      } catch {
        window.localStorage.removeItem(POKEMON_STORAGE_KEY);
      }
    }

    const storedRegions = window.localStorage.getItem(REGIONS_STORAGE_KEY);
    if (storedRegions) {
      try {
        const savedRegions = JSON.parse(storedRegions) as StoredRegion[];
        setRegions(
          Array.from(
            new Set(
              savedRegions
                .map((region) => region.name?.trim())
                .filter((name): name is string => Boolean(name)),
            ),
          ),
        );
      } catch {
        setRegions([]);
      }
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoaded) {
      window.localStorage.setItem(POKEMON_STORAGE_KEY, JSON.stringify(pokemon));
    }
  }, [hasLoaded, pokemon]);

  useEffect(() => {
    let active = true;
    getPokemon(1025).then((options) => {
      if (active) setPokemonOptions(options);
    });
    return () => {
      active = false;
    };
  }, []);

  function resetForm() {
    setSpeciesSearch("");
    setSpeciesMenuVisible(false);
    setNickname("");
    setNature("");
    setAbility("");
    setHeldItem("");
    setMoves(["", "", "", ""]);
    setRegionName("");
  }

  function openCreateMenu() {
    resetForm();
    setEditingIndex(null);
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    const entry = pokemon[index];
    setSpeciesSearch(entry.species);
    setNickname(entry.nickname);
    setNature(entry.nature);
    setAbility(entry.ability);
    setHeldItem(entry.heldItem);
    setMoves(
      entry.moves.length === 4
        ? entry.moves
        : [...entry.moves, "", "", "", ""].slice(0, 4),
    );
    setRegionName(entry.regionName);
    setSpeciesMenuVisible(false);
    setEditingIndex(index);
    setMenuVisible(true);
  }

  function savePokemon() {
    const selectedSpecies = pokemonOptions.some(
      (option) => option.name === speciesSearch,
    )
      ? speciesSearch
      : "";
    if (!selectedSpecies) return;

    const entry = {
      species: selectedSpecies,
      nickname: nickname.trim(),
      nature: nature.trim(),
      ability: ability.trim(),
      heldItem: heldItem.trim(),
      moves: moves.map((move) => move.trim()),
      regionName,
    };

    setPokemon((currentPokemon) =>
      editingIndex === null
        ? [...currentPokemon, entry]
        : currentPokemon.map((currentEntry, index) =>
            index === editingIndex ? entry : currentEntry,
          ),
    );
    setMenuVisible(false);
  }

  function deletePokemon() {
    if (editingIndex === null) return;
    setPokemon((currentPokemon) =>
      currentPokemon.filter((_, index) => index !== editingIndex),
    );
    setMenuVisible(false);
  }

  const filteredOptions = pokemonOptions.filter((option) =>
    option.name.includes(speciesSearch.toLowerCase()),
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Pokemon</ThemedText>
      {pokemon.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">No Pokémon Yet</ThemedText>
          <Pressable onPress={openCreateMenu} style={styles.primaryButton}>
            <ThemedText type="smallBold">Add Pokémon</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <View style={styles.listSection}>
          <ThemedView type="backgroundElement" style={styles.listArea}>
            <ScrollView contentContainerStyle={styles.listContent}>
              {pokemon.map((entry, index) => {
                const option = pokemonOptions.find(
                  (currentOption) => currentOption.name === entry.species,
                );
                return (
                  <Pressable
                    key={`${entry.species}-${index}`}
                    onPress={() => openEditMenu(index)}
                    style={({ pressed }) => [
                      styles.pokemonRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    {option ? (
                      <Image
                        source={{ uri: getPokemonImageUrl(option.url) }}
                        style={styles.pokemonImage}
                      />
                    ) : null}
                    <View style={styles.pokemonDetails}>
                      <ThemedText type="subtitle">
                        {entry.nickname || formatPokemonName(entry.species)}
                      </ThemedText>
                      <ThemedText type="small">
                        {formatPokemonName(entry.species)}
                        {entry.nature ? ` • ${entry.nature}` : ""}
                      </ThemedText>
                      {entry.regionName ? (
                        <ThemedText type="small">
                          Region: {entry.regionName}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
          <Pressable onPress={openCreateMenu} style={styles.addButton}>
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
            <ScrollView contentContainerStyle={styles.formContent}>
              <ThemedText type="subtitle" style={styles.menuTitle}>
                {editingIndex === null ? "Add Pokémon" : "Edit Pokémon"}
              </ThemedText>
              <ThemedText type="smallBold">Species</ThemedText>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => {
                  setSpeciesSearch(value.toLowerCase());
                  setSpeciesMenuVisible(true);
                }}
                placeholder="Search Pokémon"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={speciesSearch}
              />
              {speciesMenuVisible && speciesSearch ? (
                <View style={styles.speciesOptions}>
                  {filteredOptions.slice(0, 30).map((option) => (
                    <Pressable
                      key={option.name}
                      onPress={() => {
                        setSpeciesSearch(option.name);
                        setSpeciesMenuVisible(false);
                      }}
                      style={styles.speciesOption}
                    >
                      <ThemedText type="small">
                        {formatPokemonName(option.name)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <TextInputField
                label="Nickname"
                value={nickname}
                onChangeText={setNickname}
              />
              <TextInputField
                label="Nature"
                value={nature}
                onChangeText={setNature}
              />
              <TextInputField
                label="Ability"
                value={ability}
                onChangeText={setAbility}
              />
              <TextInputField
                label="Held Item"
                value={heldItem}
                onChangeText={setHeldItem}
              />
              <ThemedText type="smallBold">Moves</ThemedText>
              {moves.map((move, index) => (
                <TextInputField
                  key={index}
                  label={`Move ${index + 1}`}
                  value={move}
                  onChangeText={(value) =>
                    setMoves((currentMoves) =>
                      currentMoves.map((currentMove, moveIndex) =>
                        moveIndex === index ? value : currentMove,
                      ),
                    )
                  }
                />
              ))}
              <ThemedText type="smallBold">Region</ThemedText>
              <View style={styles.regionOptions}>
                <Pressable
                  onPress={() => setRegionName("")}
                  style={[styles.regionOption, !regionName && styles.selected]}
                >
                  <ThemedText type="small">None</ThemedText>
                </Pressable>
                {regions.map((region) => (
                  <Pressable
                    key={region}
                    onPress={() => setRegionName(region)}
                    style={[
                      styles.regionOption,
                      regionName === region && styles.selected,
                    ]}
                  >
                    <ThemedText type="small">{region}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={savePokemon} style={styles.primaryButton}>
                <ThemedText type="smallBold">Save Pokémon</ThemedText>
              </Pressable>
              {editingIndex !== null ? (
                <Pressable onPress={deletePokemon} style={styles.deleteButton}>
                  <ThemedText type="smallBold">Delete Pokémon</ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={styles.closeButton}
              >
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </ScrollView>
          </ThemedView>
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
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 16,
    marginTop: 24,
  },
  listSection: {
    width: "100%",
    maxWidth: 640,
    marginTop: 24,
    position: "relative",
  },
  listArea: {
    padding: 24,
    paddingTop: 68,
    borderRadius: 16,
  },
  listContent: {
    gap: 12,
  },
  pokemonRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  pokemonImage: {
    width: 56,
    height: 56,
  },
  pokemonDetails: {
    flex: 1,
    gap: 2,
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
    maxWidth: 560,
    maxHeight: "92%",
    padding: 24,
    borderRadius: 16,
  },
  formContent: {
    gap: 12,
    paddingBottom: 4,
  },
  menuTitle: {
    textAlign: "center",
  },
  fieldGroup: {
    gap: 6,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  speciesOptions: {
    maxHeight: 180,
    borderRadius: 8,
    backgroundColor: "#212225",
  },
  speciesOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  regionOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  regionOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  selected: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  primaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(180, 50, 50, 0.8)",
  },
  closeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
