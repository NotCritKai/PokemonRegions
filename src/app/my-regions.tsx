import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
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
const MAX_TEAM_POKEMON = 6;

type Region = {
  name: string;
  rivalName: string;
  type: string;
  routes: string;
  routeNames: string[];
  routePokemon: Record<string, RoutePokemon[]>;
  routeDetails: Record<string, RouteDetails>;
  gyms: string[];
  gymDetails: GymDetails[];
  gymPokemon: TeamPokemon[][];
  eliteFour: string[];
  eliteFourPokemon: TeamPokemon[][];
  champion: string | null;
  championPokemon: TeamPokemon[];
  mapPositions: Record<string, MapPosition>;
};
type RoutePokemon = {
  name: string;
  percentage: string;
};
type RouteDetails = {
  terrain: string;
  difficulty: string;
  items: string;
  trainers: string;
};
type GymDetails = {
  leader: string;
  specialty: string;
  badge: string;
  levelCap: string;
  reward: string;
  puzzle: string;
};
type TeamPokemon = {
  name: string;
  moves: string[];
};
type MapPosition = {
  x: number;
  y: number;
};
const biomeMapThemes: Record<
  string,
  {
    base: string;
    water: string;
    forest: string;
    highlands: string;
    path: string;
    pathLight: string;
    pathDark: string;
  }
> = {
  Grassland: {
    base: "#6b9f67",
    water: "rgba(77, 157, 190, 0.72)",
    forest: "rgba(38, 104, 62, 0.72)",
    highlands: "rgba(168, 145, 88, 0.26)",
    path: "#b88b52",
    pathLight: "#d2ad72",
    pathDark: "#a97943",
  },
  Mountain: {
    base: "#898b86",
    water: "rgba(83, 133, 151, 0.7)",
    forest: "rgba(49, 78, 63, 0.72)",
    highlands: "rgba(207, 201, 178, 0.42)",
    path: "#89745d",
    pathLight: "#b5a181",
    pathDark: "#6d5b49",
  },
  Ocean: {
    base: "#d4b477",
    water: "#4f9fb4",
    forest: "rgba(88, 139, 111, 0.48)",
    highlands: "rgba(239, 211, 145, 0.64)",
    path: "#ad8450",
    pathLight: "#d1a86d",
    pathDark: "#93683d",
  },
  Forest: {
    base: "#4f8757",
    water: "rgba(70, 137, 150, 0.68)",
    forest: "rgba(24, 75, 44, 0.78)",
    highlands: "rgba(109, 137, 74, 0.34)",
    path: "#967044",
    pathLight: "#bd965a",
    pathDark: "#765331",
  },
  Desert: {
    base: "#d8b56d",
    water: "rgba(79, 151, 165, 0.62)",
    forest: "rgba(137, 118, 52, 0.42)",
    highlands: "rgba(239, 213, 139, 0.58)",
    path: "#a8743c",
    pathLight: "#d2a25e",
    pathDark: "#875729",
  },
  Tundra: {
    base: "#d6e2df",
    water: "rgba(106, 165, 188, 0.72)",
    forest: "rgba(104, 143, 145, 0.52)",
    highlands: "rgba(242, 248, 244, 0.68)",
    path: "#91a8ad",
    pathLight: "#c4d8d8",
    pathDark: "#718c94",
  },
};
const biomes = ["Grassland", "Mountain", "Ocean", "Forest", "Desert", "Tundra"];
const routeCounts = Array.from({ length: 39 }, (_, index) => String(index + 1));
const gymCounts = Array.from({ length: 8 }, (_, index) => String(index + 1));
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

function getSuggestedGymCount(routeCount: number) {
  if (routeCount <= 0) return 0;
  if (routeCount <= 5) return 2;
  if (routeCount <= 10) return 4;
  if (routeCount <= 17) return 6;
  return 8;
}

export default function MyRegionsScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [regionName, setRegionName] = useState("");
  const [rivalName, setRivalName] = useState("");
  const [regionType, setRegionType] = useState("");
  const [routeCount, setRouteCount] = useState("");
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);
  const [dataMenuVisible, setDataMenuVisible] = useState(false);
  const [dataMode, setDataMode] = useState<"export" | "import">("export");
  const [transferText, setTransferText] = useState("");
  const [transferError, setTransferError] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [hasLoadedRegions, setHasLoadedRegions] = useState(false);
  const [editingRegionIndex, setEditingRegionIndex] = useState<number | null>(
    null,
  );
  const [contentMenuVisible, setContentMenuVisible] = useState(false);
  const [contentRegionIndex, setContentRegionIndex] = useState<number | null>(
    null,
  );
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [gymsExpanded, setGymsExpanded] = useState(false);
  const [eliteFourExpanded, setEliteFourExpanded] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const contentReveal = useRef(new Animated.Value(1)).current;
  const [mapPositions, setMapPositions] = useState<Record<string, MapPosition>>(
    {},
  );
  const mapDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origin: MapPosition;
  } | null>(null);
  const mapPositionsRef = useRef<Record<string, MapPosition>>({});
  const [gymCountMenuVisible, setGymCountMenuVisible] = useState(false);
  const [customGymCount, setCustomGymCount] = useState("");
  const [gymContentMenuVisible, setGymContentMenuVisible] = useState(false);
  const [editingGymIndex, setEditingGymIndex] = useState<number | null>(null);
  const [gymName, setGymName] = useState("");
  const [gymDetails, setGymDetails] = useState<GymDetails>({
    leader: "",
    specialty: "",
    badge: "",
    levelCap: "",
    reward: "",
    puzzle: "",
  });
  const [teamMenuVisible, setTeamMenuVisible] = useState(false);
  const [teamKind, setTeamKind] = useState<
    "gym" | "eliteFour" | "champion" | null
  >(null);
  const [teamIndex, setTeamIndex] = useState<number | null>(null);
  const [teamPokemon, setTeamPokemon] = useState<TeamPokemon[]>([]);
  const [teamPokemonMenuIndex, setTeamPokemonMenuIndex] = useState<
    number | null
  >(null);
  const [teamPokemonSearch, setTeamPokemonSearch] = useState("");
  const [eliteMemberMenuVisible, setEliteMemberMenuVisible] = useState(false);
  const [editingEliteKind, setEditingEliteKind] = useState<
    "eliteFour" | "champion" | null
  >(null);
  const [editingEliteIndex, setEditingEliteIndex] = useState<number | null>(
    null,
  );
  const [eliteMemberName, setEliteMemberName] = useState("");
  const [eliteCreationKind, setEliteCreationKind] = useState<
    "eliteFour" | "champion" | null
  >(null);
  const [eliteCreationNames, setEliteCreationNames] = useState<string[]>([]);
  const [routeContentMenuVisible, setRouteContentMenuVisible] = useState(false);
  const [selectedRouteName, setSelectedRouteName] = useState("");
  const [selectedRoutePokemon, setSelectedRoutePokemon] = useState<
    RoutePokemon[]
  >([]);
  const [routeDetails, setRouteDetails] = useState<RouteDetails>({
    terrain: "",
    difficulty: "",
    items: "",
    trainers: "",
  });
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
            routeDetails: region.routeDetails ?? {},
            gyms: region.gyms ?? [],
            gymDetails: region.gymDetails ?? [],
            gymPokemon: region.gymPokemon ?? [],
            eliteFour: region.eliteFour ?? [],
            eliteFourPokemon: region.eliteFourPokemon ?? [],
            champion: region.champion ?? null,
            championPokemon: region.championPokemon ?? [],
            mapPositions: region.mapPositions ?? {},
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

  function openExportMenu() {
    setDataMode("export");
    setTransferError(false);
    setTransferText(JSON.stringify(regions, null, 2));
    setDataMenuVisible(true);
  }

  function openImportMenu() {
    setDataMode("import");
    setTransferError(false);
    setTransferText("");
    setDataMenuVisible(true);
  }

  function importRegions() {
    try {
      const importedRegions = JSON.parse(transferText) as Partial<Region>[];
      if (!Array.isArray(importedRegions)) throw new Error("Invalid data");

      setRegions(
        importedRegions.map((region) => ({
          name: region.name ?? "",
          rivalName: region.rivalName ?? "",
          type: region.type ?? "",
          routes: region.routes ?? "",
          routeNames: region.routeNames ?? [],
          routePokemon: region.routePokemon ?? {},
          routeDetails: region.routeDetails ?? {},
          gyms: region.gyms ?? [],
          gymPokemon: region.gymPokemon ?? [],
          gymDetails: region.gymDetails ?? [],
          eliteFour: region.eliteFour ?? [],
          eliteFourPokemon: region.eliteFourPokemon ?? [],
          champion: region.champion ?? null,
          championPokemon: region.championPokemon ?? [],
          mapPositions: region.mapPositions ?? {},
        })),
      );
      setDataMenuVisible(false);
    } catch {
      setTransferError(true);
    }
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
    const positions = regions[index]?.mapPositions ?? {};
    setMapPositions(positions);
    mapPositionsRef.current = positions;
    setRoutesExpanded(false);
    setGymsExpanded(false);
    setEliteFourExpanded(false);
    setMapExpanded(false);
    setGymCountMenuVisible(false);
    setContentMenuVisible(true);
  }

  function toggleContentSection(
    section: "routes" | "gyms" | "eliteFour" | "map",
  ) {
    const isOpen =
      section === "routes"
        ? routesExpanded
        : section === "gyms"
          ? gymsExpanded
          : section === "eliteFour"
            ? eliteFourExpanded
            : mapExpanded;

    if (!isOpen) {
      contentReveal.stopAnimation();
      contentReveal.setValue(0);
      Animated.timing(contentReveal, {
        toValue: 1,
        duration: 680,
        easing: undefined,
        useNativeDriver: true,
      }).start();
    }

    setRoutesExpanded(section === "routes" ? (expanded) => !expanded : false);
    setGymsExpanded(section === "gyms" ? (expanded) => !expanded : false);
    setEliteFourExpanded(
      section === "eliteFour" ? (expanded) => !expanded : false,
    );
    setMapExpanded(section === "map" ? (expanded) => !expanded : false);
  }

  function getWaterfallStyle(index: number, total: number) {
    const start = total > 1 ? Math.min(0.72, (index / total) * 0.72) : 0;
    const end = Math.min(1, start + 0.28);

    return {
      opacity: contentReveal.interpolate({
        inputRange: [start, end],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateY: contentReveal.interpolate({
            inputRange: [start, end],
            outputRange: [-18, 0],
            extrapolate: "clamp",
          }),
        },
      ],
    };
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
          routeDetails: Object.fromEntries(
            region.routeNames
              .filter((_, currentIndex) => currentIndex !== routeIndex)
              .map((name, currentIndex) => [
                name.startsWith("Route ") ? `Route ${currentIndex + 1}` : name,
                region.routeDetails[name] ?? {
                  terrain: "",
                  difficulty: "",
                  items: "",
                  trainers: "",
                },
              ]),
          ),
        };
      }),
    );
  }

  function addGyms(amount: number) {
    if (contentRegionIndex === null || amount <= 0) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;

        const gyms = region.gyms ?? [];
        const numberToAdd = Math.min(amount, 8 - gyms.length);
        if (numberToAdd <= 0) return region;

        return {
          ...region,
          gyms: [
            ...gyms,
            ...Array.from(
              { length: numberToAdd },
              (_, gymIndex) => `Gym ${gyms.length + gymIndex + 1}`,
            ),
          ],
          gymPokemon: [
            ...(region.gymPokemon ?? []),
            ...Array.from({ length: numberToAdd }, () => []),
          ],
          gymDetails: [
            ...(region.gymDetails ?? []),
            ...Array.from({ length: numberToAdd }, () => ({
              leader: "",
              specialty: "",
              badge: "",
              levelCap: "",
              reward: "",
              puzzle: "",
            })),
          ],
        };
      }),
    );
  }

  function addSuggestedGyms() {
    const suggestedGymCount = getSuggestedGymCount(activeRouteLimit);
    addGyms(suggestedGymCount - activeGymNames.length);
  }

  function openCustomGymMenu() {
    setCustomGymCount("");
    setGymCountMenuVisible(true);
  }

  function addCustomGyms() {
    addGyms(Number(customGymCount));
    setGymCountMenuVisible(false);
  }

  function openGymMenu(index: number) {
    setEditingGymIndex(index);
    setGymName(activeGymNames[index] ?? "");
    setGymDetails(
      activeContentRegion?.gymDetails[index] ?? {
        leader: "",
        specialty: "",
        badge: "",
        levelCap: "",
        reward: "",
        puzzle: "",
      },
    );
    setGymContentMenuVisible(true);
  }

  function openTeamMenu(
    kind: "gym" | "eliteFour" | "champion",
    index?: number,
  ) {
    const selectedIndex = index ?? 0;
    const region = activeContentRegion;
    if (!region) return;

    const selectedTeam =
      kind === "gym"
        ? (region.gymPokemon[selectedIndex] ?? [])
        : kind === "eliteFour"
          ? (region.eliteFourPokemon[selectedIndex] ?? [])
          : region.championPokemon;
    setTeamKind(kind);
    setTeamIndex(kind === "champion" ? null : selectedIndex);
    setTeamPokemon(selectedTeam);
    setTeamPokemonMenuIndex(null);
    setTeamPokemonSearch("");
    setTeamMenuVisible(true);
  }

  function addTeamPokemon() {
    if (teamPokemon.length >= MAX_TEAM_POKEMON) return;

    setTeamPokemon((currentPokemon) => [
      ...currentPokemon,
      { name: "", moves: ["", "", "", ""] },
    ]);
  }

  function updateTeamPokemon(index: number, changes: Partial<TeamPokemon>) {
    setTeamPokemon((currentPokemon) =>
      currentPokemon.map((pokemon, pokemonIndex) =>
        pokemonIndex === index ? { ...pokemon, ...changes } : pokemon,
      ),
    );
  }

  function updateTeamMove(
    pokemonIndex: number,
    moveIndex: number,
    move: string,
  ) {
    setTeamPokemon((currentPokemon) =>
      currentPokemon.map((pokemon, currentPokemonIndex) =>
        currentPokemonIndex === pokemonIndex
          ? {
              ...pokemon,
              moves: pokemon.moves.map((currentMove, currentMoveIndex) =>
                currentMoveIndex === moveIndex ? move : currentMove,
              ),
            }
          : pokemon,
      ),
    );
  }

  function saveTeam() {
    if (contentRegionIndex === null || teamKind === null) return;
    const savedTeam = teamPokemon
      .filter((pokemon) => pokemon.name)
      .slice(0, MAX_TEAM_POKEMON);

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;
        if (teamKind === "gym" && teamIndex !== null) {
          const gymPokemon = [...region.gymPokemon];
          gymPokemon[teamIndex] = savedTeam;
          return { ...region, gymPokemon };
        }
        if (teamKind === "eliteFour" && teamIndex !== null) {
          const eliteFourPokemon = [...region.eliteFourPokemon];
          eliteFourPokemon[teamIndex] = savedTeam;
          return { ...region, eliteFourPokemon };
        }
        return { ...region, championPokemon: savedTeam };
      }),
    );
    setTeamMenuVisible(false);
  }

  function saveGym() {
    if (contentRegionIndex === null || editingGymIndex === null) return;

    const name = gymName.trim() || `Gym ${editingGymIndex + 1}`;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;
        const nextGymDetails = [...region.gymDetails];
        nextGymDetails[editingGymIndex] = gymDetails;
        return {
          ...region,
          gyms: region.gyms.map((gym, gymIndex) =>
            gymIndex === editingGymIndex ? name : gym,
          ),
          gymDetails: nextGymDetails,
        };
      }),
    );
    setGymContentMenuVisible(false);
  }

  function removeGym(gymIndex: number) {
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;

        return {
          ...region,
          gyms: region.gyms
            .filter((_, currentIndex) => currentIndex !== gymIndex)
            .map((name, currentIndex) =>
              name.startsWith("Gym ") ? `Gym ${currentIndex + 1}` : name,
            ),
          gymPokemon: region.gymPokemon.filter(
            (_, currentIndex) => currentIndex !== gymIndex,
          ),
          gymDetails: region.gymDetails.filter(
            (_, currentIndex) => currentIndex !== gymIndex,
          ),
        };
      }),
    );
  }

  function addEliteFour() {
    if (contentRegionIndex === null) return;
    setEditingEliteKind("eliteFour");
    setEditingEliteIndex(null);
    setEliteCreationKind("eliteFour");
    setEliteCreationNames(["", "", "", ""]);
    setEliteMemberMenuVisible(true);
  }

  function addChampion() {
    if (contentRegionIndex === null) return;
    setEditingEliteKind("champion");
    setEditingEliteIndex(null);
    setEliteCreationKind("champion");
    setEliteCreationNames([""]);
    setEliteMemberMenuVisible(true);
  }

  function openEliteMemberMenu(
    kind: "eliteFour" | "champion",
    memberIndex?: number,
  ) {
    setEliteCreationKind(null);
    if (kind === "eliteFour") {
      const index = memberIndex ?? 0;
      setEditingEliteKind("eliteFour");
      setEditingEliteIndex(index);
      setEliteMemberName(activeEliteFourNames[index] ?? "");
    } else {
      setEditingEliteKind("champion");
      setEditingEliteIndex(null);
      setEliteMemberName(activeChampionName ?? "");
    }
    setEliteMemberMenuVisible(true);
  }

  function saveEliteMember() {
    if (contentRegionIndex === null || editingEliteKind === null) return;

    if (eliteCreationKind !== null) {
      const names = eliteCreationNames.map((name) => name.trim());
      if (names.some((name) => !name)) return;

      setRegions((currentRegions) =>
        currentRegions.map((region, index) => {
          if (index !== contentRegionIndex) return region;

          return eliteCreationKind === "eliteFour"
            ? {
                ...region,
                eliteFour: names.map((name) => `Elite: ${name}`),
                eliteFourPokemon: names.map(() => []),
              }
            : { ...region, champion: `Champion: ${names[0]}` };
        }),
      );
      setEliteMemberMenuVisible(false);
      return;
    }

    if (editingEliteKind === "eliteFour" && editingEliteIndex !== null) {
      const name = eliteMemberName.trim() || `Elite 4 ${editingEliteIndex + 1}`;
      setRegions((currentRegions) =>
        currentRegions.map((region, index) =>
          index === contentRegionIndex
            ? {
                ...region,
                eliteFour: region.eliteFour.map((member, memberIndex) =>
                  memberIndex === editingEliteIndex ? name : member,
                ),
              }
            : region,
        ),
      );
    } else if (editingEliteKind === "champion") {
      const name = eliteMemberName.trim() || "Champion";
      setRegions((currentRegions) =>
        currentRegions.map((region, index) =>
          index === contentRegionIndex ? { ...region, champion: name } : region,
        ),
      );
    }

    setEliteMemberMenuVisible(false);
  }

  function removeEliteFour(memberIndex: number) {
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex) return region;

        return {
          ...region,
          eliteFour: region.eliteFour
            .filter((_, currentIndex) => currentIndex !== memberIndex)
            .map((name, currentIndex) =>
              name.startsWith("Elite 4 ")
                ? `Elite 4 ${currentIndex + 1}`
                : name,
            ),
          eliteFourPokemon: region.eliteFourPokemon.filter(
            (_, currentIndex) => currentIndex !== memberIndex,
          ),
        };
      }),
    );
  }

  function removeChampion() {
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex ? { ...region, champion: null } : region,
      ),
    );
  }

  function getDefaultMapPosition(index: number): MapPosition {
    const columns = 6;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = ((index * 37) % 17) - 8;
    const jitterY = ((index * 53) % 15) - 7;

    return {
      x: Math.max(8, Math.min(390, 10 + column * 76 + jitterX)),
      y: Math.max(34, Math.min(462, 34 + row * 70 + jitterY)),
    };
  }

  function getMapPosition(id: string, index: number) {
    if (mapPositions[id]) return mapPositions[id];
    if (id.startsWith("gym-")) {
      const gymPositions = [
        { x: 286, y: 42 },
        { x: 322, y: 142 },
        { x: 276, y: 264 },
        { x: 174, y: 282 },
        { x: 34, y: 252 },
        { x: 20, y: 148 },
        { x: 188, y: 74 },
        { x: 122, y: 178 },
      ];
      return gymPositions[index % gymPositions.length];
    }
    return getDefaultMapPosition(index);
  }

  function getRouteConnectorStyle(from: MapPosition, to: MapPosition) {
    const fromCenter = { x: from.x + 46, y: from.y + 31 };
    const toCenter = { x: to.x + 46, y: to.y + 31 };
    const deltaX = toCenter.x - fromCenter.x;
    const deltaY = toCenter.y - fromCenter.y;
    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);

    return {
      left: fromCenter.x,
      top: fromCenter.y - 7,
      width: length,
      transform: [{ rotate: `${Math.atan2(deltaY, deltaX)}rad` }],
    };
  }

  function startMapDrag(
    id: string,
    position: MapPosition,
    event: { nativeEvent: { pageX: number; pageY: number } },
  ) {
    mapDragRef.current = {
      id,
      startX: event.nativeEvent.pageX,
      startY: event.nativeEvent.pageY,
      origin: position,
    };
  }

  function moveMapDrag(event: {
    nativeEvent: { pageX: number; pageY: number };
  }) {
    const drag = mapDragRef.current;
    if (!drag) return;

    setMapPositions((currentPositions) => {
      const nextPositions = {
        ...currentPositions,
        [drag.id]: {
          x: Math.max(
            8,
            Math.min(
              390,
              drag.origin.x + event.nativeEvent.pageX - drag.startX,
            ),
          ),
          y: Math.max(
            8,
            Math.min(
              462,
              drag.origin.y + event.nativeEvent.pageY - drag.startY,
            ),
          ),
        },
      };
      mapPositionsRef.current = nextPositions;
      return nextPositions;
    });
  }

  function finishMapDrag() {
    mapDragRef.current = null;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex
          ? { ...region, mapPositions: mapPositionsRef.current }
          : region,
      ),
    );
  }

  function openRouteMenu(routeName: string) {
    setSelectedRouteName(routeName);
    setRouteContentMenuVisible(true);
    setSelectedRoutePokemon(
      activeContentRegion?.routePokemon?.[routeName] ?? [],
    );
    setRouteDetails(
      activeContentRegion?.routeDetails?.[routeName] ?? {
        terrain: "",
        difficulty: "",
        items: "",
        trainers: "",
      },
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
        routeDetails: {},
        gyms: [],
        gymDetails: [],
        gymPokemon: [],
        eliteFour: [],
        eliteFourPokemon: [],
        champion: null,
        championPokemon: [],
        mapPositions: {},
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
              routeDetails: region.routeDetails ?? {},
              gyms: region.gyms ?? [],
              gymDetails: region.gymDetails ?? [],
              gymPokemon: region.gymPokemon ?? [],
              eliteFour: region.eliteFour ?? [],
              eliteFourPokemon: region.eliteFourPokemon ?? [],
              champion: region.champion ?? null,
              championPokemon: region.championPokemon ?? [],
              mapPositions: region.mapPositions ?? {},
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
              routeDetails: {
                ...region.routeDetails,
                [selectedRouteName]: routeDetails,
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
  const activeGymNames = activeContentRegion?.gyms ?? [];
  const activeRouteLimit = Number(activeContentRegion?.routes);
  const canAddRoute =
    activeRouteLimit <= 0 || activeRouteNames.length < activeRouteLimit;
  const suggestedGymCount = getSuggestedGymCount(activeRouteLimit);
  const canAddSuggestedGyms =
    suggestedGymCount > 0 && activeGymNames.length < suggestedGymCount;
  const remainingGymSlots = 8 - activeGymNames.length;
  const activeGymPokemon = activeContentRegion?.gymPokemon ?? [];
  const activeEliteFourNames = activeContentRegion?.eliteFour ?? [];
  const activeEliteFourPokemon = activeContentRegion?.eliteFourPokemon ?? [];
  const activeChampionName = activeContentRegion?.champion ?? null;
  const mapTheme =
    biomeMapThemes[activeContentRegion?.type ?? "Grassland"] ??
    biomeMapThemes.Grassland;
  const canAddEliteFour = activeEliteFourNames.length < 4;
  const canAddChampion = !activeChampionName;

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

      <View style={styles.dataActions}>
        <Pressable onPress={openExportMenu} style={styles.dataButton}>
          <ThemedText type="smallBold">Export Regions</ThemedText>
        </Pressable>
        <Pressable onPress={openImportMenu} style={styles.dataButton}>
          <ThemedText type="smallBold">Import Regions</ThemedText>
        </Pressable>
      </View>

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
        onRequestClose={() => setDataMenuVisible(false)}
        transparent
        visible={dataMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.dataMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {dataMode === "export" ? "Export Regions" : "Import Regions"}
            </ThemedText>
            <TextInput
              multiline
              onChangeText={setTransferText}
              editable={dataMode === "import"}
              style={styles.transferInput}
              value={transferText}
            />
            {transferError ? (
              <ThemedText style={styles.transferError}>
                Invalid region JSON.
              </ThemedText>
            ) : null}
            {dataMode === "import" ? (
              <Pressable
                onPress={importRegions}
                style={styles.createMenuButton}
              >
                <ThemedText type="smallBold">Import</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setDataMenuVisible(false)}
              style={styles.closeButton}
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
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.contentMenuScroll}
              contentContainerStyle={styles.contentMenuScrollContent}
            >
              <ThemedText type="subtitle" style={styles.menuTitle}>
                {contentRegionIndex === null
                  ? "Content"
                  : `Content - ${regions[contentRegionIndex]?.name ?? "Region"}`}
              </ThemedText>
              <View style={styles.overviewGrid}>
                <View style={styles.overviewStat}>
                  <ThemedText type="smallBold">Routes</ThemedText>
                  <ThemedText type="subtitle">
                    {activeRouteNames.length}
                  </ThemedText>
                </View>
                <View style={styles.overviewStat}>
                  <ThemedText type="smallBold">Gyms</ThemedText>
                  <ThemedText type="subtitle">
                    {activeGymNames.length}
                  </ThemedText>
                </View>
                <View style={styles.overviewStat}>
                  <ThemedText type="smallBold">Elite 4</ThemedText>
                  <ThemedText type="subtitle">
                    {activeEliteFourNames.length}/4
                  </ThemedText>
                </View>
                <View style={styles.overviewStat}>
                  <ThemedText type="smallBold">Champion</ThemedText>
                  <ThemedText type="subtitle">
                    {activeChampionName ? "Yes" : "No"}
                  </ThemedText>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleContentSection("routes")}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Routes</ThemedText>
                <ThemedText type="smallBold">
                  {routesExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {routesExpanded ? (
                <View style={styles.contentDropdownContent}>
                  <ScrollView
                    style={styles.contentRouteList}
                    contentContainerStyle={styles.contentRouteContent}
                    showsVerticalScrollIndicator
                  >
                    {activeRouteNames.map((routeName, routeIndex) => (
                      <Animated.View
                        key={`${routeName}-${routeIndex}`}
                        style={getWaterfallStyle(
                          routeIndex,
                          activeRouteNames.length + 1,
                        )}
                      >
                        <View style={styles.routeActionRow}>
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
                      </Animated.View>
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
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleContentSection("gyms")}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Gyms</ThemedText>
                <ThemedText type="smallBold">
                  {gymsExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {gymsExpanded ? (
                <View style={styles.contentDropdownContent}>
                  <View style={styles.gymActions}>
                    <Pressable
                      onPress={addSuggestedGyms}
                      disabled={!canAddSuggestedGyms}
                      style={({ pressed }) => [
                        styles.gymActionButton,
                        !canAddSuggestedGyms && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        {canAddSuggestedGyms
                          ? `Add Suggested Gyms (${suggestedGymCount})`
                          : suggestedGymCount === 0
                            ? "Set Routes First"
                            : "Suggested Gyms Added"}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={openCustomGymMenu}
                      disabled={remainingGymSlots <= 0}
                      style={({ pressed }) => [
                        styles.gymActionButton,
                        remainingGymSlots <= 0 && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">Add Custom Gyms</ThemedText>
                    </Pressable>
                  </View>
                  <ScrollView
                    style={styles.contentRouteList}
                    contentContainerStyle={styles.contentRouteContent}
                    showsVerticalScrollIndicator
                  >
                    {activeGymNames.map((gymName, gymIndex) => (
                      <Animated.View
                        key={`${gymName}-${gymIndex}`}
                        style={getWaterfallStyle(
                          gymIndex + 1,
                          activeGymNames.length + 2,
                        )}
                      >
                        <View style={styles.routeActionRow}>
                          <Pressable
                            accessibilityLabel={`Edit ${gymName}`}
                            accessibilityRole="button"
                            onPress={() => openGymMenu(gymIndex)}
                            style={({ pressed }) => [
                              styles.routeOptionButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="small">{gymName}</ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Pokemon for ${gymName}`}
                            accessibilityRole="button"
                            onPress={() => openTeamMenu("gym", gymIndex)}
                            style={({ pressed }) => [
                              styles.teamButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">
                              {activeGymPokemon[gymIndex]?.length
                                ? `Pokemon (${activeGymPokemon[gymIndex].length})`
                                : "Pokemon"}
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Remove ${gymName}`}
                            accessibilityRole="button"
                            onPress={() => removeGym(gymIndex)}
                            style={({ pressed }) => [
                              styles.removeRouteButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">Remove</ThemedText>
                          </Pressable>
                        </View>
                      </Animated.View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleContentSection("eliteFour")}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Elite 4 / Champion</ThemedText>
                <ThemedText type="smallBold">
                  {eliteFourExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {eliteFourExpanded ? (
                <Animated.View style={getWaterfallStyle(0, 1)}>
                  <View style={styles.contentDropdownContent}>
                    <View style={styles.gymActions}>
                      <Pressable
                        onPress={addEliteFour}
                        disabled={!canAddEliteFour}
                        style={({ pressed }) => [
                          styles.gymActionButton,
                          !canAddEliteFour && styles.disabledButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText type="smallBold">
                          {canAddEliteFour ? "Add Elite 4" : "Elite 4 Added"}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={addChampion}
                        disabled={!canAddChampion}
                        style={({ pressed }) => [
                          styles.gymActionButton,
                          !canAddChampion && styles.disabledButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText type="smallBold">
                          {canAddChampion ? "Add Champion" : "Champion Added"}
                        </ThemedText>
                      </Pressable>
                    </View>
                    <ScrollView
                      style={styles.contentRouteList}
                      contentContainerStyle={styles.contentRouteContent}
                      showsVerticalScrollIndicator
                    >
                      {activeEliteFourNames.map((memberName, memberIndex) => (
                        <View
                          key={`${memberName}-${memberIndex}`}
                          style={styles.routeActionRow}
                        >
                          <Pressable
                            accessibilityLabel={`Edit ${memberName}`}
                            accessibilityRole="button"
                            onPress={() =>
                              openEliteMemberMenu("eliteFour", memberIndex)
                            }
                            style={({ pressed }) => [
                              styles.routeOptionButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="small">{memberName}</ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Pokemon for ${memberName}`}
                            accessibilityRole="button"
                            onPress={() =>
                              openTeamMenu("eliteFour", memberIndex)
                            }
                            style={({ pressed }) => [
                              styles.teamButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">
                              {activeEliteFourPokemon[memberIndex]?.length
                                ? `Pokemon (${activeEliteFourPokemon[memberIndex].length})`
                                : "Pokemon"}
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Remove ${memberName}`}
                            accessibilityRole="button"
                            onPress={() => removeEliteFour(memberIndex)}
                            style={({ pressed }) => [
                              styles.removeRouteButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">Remove</ThemedText>
                          </Pressable>
                        </View>
                      ))}
                      {activeChampionName ? (
                        <View style={styles.routeActionRow}>
                          <Pressable
                            accessibilityLabel={`Edit ${activeChampionName}`}
                            accessibilityRole="button"
                            onPress={() => openEliteMemberMenu("champion")}
                            style={({ pressed }) => [
                              styles.routeOptionButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="small">
                              {activeChampionName}
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Pokemon for ${activeChampionName}`}
                            accessibilityRole="button"
                            onPress={() => openTeamMenu("champion")}
                            style={({ pressed }) => [
                              styles.teamButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">
                              {activeContentRegion?.championPokemon.length
                                ? `Pokemon (${activeContentRegion.championPokemon.length})`
                                : "Pokemon"}
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Remove ${activeChampionName}`}
                            accessibilityRole="button"
                            onPress={removeChampion}
                            style={({ pressed }) => [
                              styles.removeRouteButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText type="smallBold">Remove</ThemedText>
                          </Pressable>
                        </View>
                      ) : null}
                    </ScrollView>
                  </View>
                </Animated.View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleContentSection("map")}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Map</ThemedText>
                <ThemedText type="smallBold">
                  {mapExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {mapExpanded ? (
                <Animated.View style={getWaterfallStyle(0, 1)}>
                  <View
                    style={[
                      styles.mapCanvas,
                      { backgroundColor: mapTheme.base },
                    ]}
                  >
                    <View
                      pointerEvents="none"
                      style={[
                        styles.mapWater,
                        { backgroundColor: mapTheme.water },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.mapForest,
                        { backgroundColor: mapTheme.forest },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.mapHighlands,
                        { backgroundColor: mapTheme.highlands },
                      ]}
                    />
                    {activeRouteNames.slice(1).map((_, routeIndex) => {
                      const previousPosition = getMapPosition(
                        `route-${routeIndex}`,
                        routeIndex,
                      );
                      const currentPosition = getMapPosition(
                        `route-${routeIndex + 1}`,
                        routeIndex + 1,
                      );
                      return (
                        <View
                          key={`route-connector-${routeIndex + 1}`}
                          pointerEvents="none"
                          style={[
                            styles.routeConnector,
                            { backgroundColor: mapTheme.path },
                            getRouteConnectorStyle(
                              previousPosition,
                              currentPosition,
                            ),
                          ]}
                        />
                      );
                    })}
                    {activeRouteNames.map((routeName, routeIndex) => {
                      const id = `route-${routeIndex}`;
                      const position = getMapPosition(id, routeIndex);
                      return (
                        <View
                          key={id}
                          onResponderGrant={(event) =>
                            startMapDrag(id, position, event)
                          }
                          onResponderMove={moveMapDrag}
                          onResponderRelease={finishMapDrag}
                          onResponderTerminate={finishMapDrag}
                          onStartShouldSetResponder={() => true}
                          style={[
                            styles.routeMapPiece,
                            { left: position.x, top: position.y },
                          ]}
                        >
                          <View
                            pointerEvents="none"
                            style={[
                              styles.routePathSegmentA,
                              { backgroundColor: mapTheme.pathLight },
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={[
                              styles.routePathSegmentB,
                              { backgroundColor: mapTheme.pathLight },
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={[
                              styles.routePathSegmentC,
                              { backgroundColor: mapTheme.pathDark },
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={styles.routePathLabel}
                          >
                            <ThemedText type="smallBold">
                              {routeName}
                            </ThemedText>
                          </View>
                        </View>
                      );
                    })}
                    {activeGymNames.map((_, gymIndex) => {
                      const id = `gym-${gymIndex}`;
                      const position = getMapPosition(id, gymIndex);
                      return (
                        <View
                          key={id}
                          onResponderGrant={(event) =>
                            startMapDrag(id, position, event)
                          }
                          onResponderMove={moveMapDrag}
                          onResponderRelease={finishMapDrag}
                          onResponderTerminate={finishMapDrag}
                          onStartShouldSetResponder={() => true}
                          style={[
                            styles.gymMapPiece,
                            { left: position.x, top: position.y },
                          ]}
                        >
                          <ThemedText style={styles.gymEmoji}>🏫</ThemedText>
                          <ThemedText type="smallBold" style={styles.gymIndex}>
                            {gymIndex + 1}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>
              ) : null}
              <Pressable
                onPress={() => setContentMenuVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Close</ThemedText>
              </Pressable>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setGymCountMenuVisible(false)}
        transparent
        visible={gymCountMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.gymCountMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              Add Custom Gyms
            </ThemedText>
            <ThemedText type="smallBold">How many gyms?</ThemedText>
            <View style={styles.gymCountGrid}>
              {gymCounts.map((count) => {
                const exceedsLimit = Number(count) > remainingGymSlots;
                return (
                  <Pressable
                    key={count}
                    disabled={exceedsLimit}
                    onPress={() => setCustomGymCount(count)}
                    style={[
                      styles.gymCountOption,
                      customGymCount === count && styles.selectedDropdown,
                      exceedsLimit && styles.disabledButton,
                    ]}
                  >
                    <ThemedText type="smallBold">{count}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={!customGymCount}
              onPress={addCustomGyms}
              style={({ pressed }) => [
                styles.createMenuButton,
                !customGymCount && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Add Gyms</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setGymCountMenuVisible(false)}
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
        onRequestClose={() => setGymContentMenuVisible(false)}
        transparent
        visible={gymContentMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.gymEditMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              Edit Gym
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Gym Name</ThemedText>
              <TextInput
                placeholder="e.x. Boulder Gym"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setGymName}
                style={styles.input}
                value={gymName}
              />
            </View>
            <DetailInput
              label="Leader"
              value={gymDetails.leader}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, leader: value }))
              }
            />
            <DetailInput
              label="Specialty"
              value={gymDetails.specialty}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, specialty: value }))
              }
            />
            <DetailInput
              label="Badge"
              value={gymDetails.badge}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, badge: value }))
              }
            />
            <DetailInput
              label="Level Cap"
              value={gymDetails.levelCap}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, levelCap: value }))
              }
            />
            <DetailInput
              label="Reward"
              value={gymDetails.reward}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, reward: value }))
              }
            />
            <DetailInput
              label="Puzzle"
              value={gymDetails.puzzle}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, puzzle: value }))
              }
            />
            <Pressable
              onPress={saveGym}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Save Changes</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setGymContentMenuVisible(false)}
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
        onRequestClose={() => setTeamMenuVisible(false)}
        transparent
        visible={teamMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.teamMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {teamKind === "gym"
                ? "Gym Pokemon"
                : teamKind === "champion"
                  ? "Champion Pokemon"
                  : "Elite 4 Pokemon"}
            </ThemedText>
            <ScrollView
              style={styles.teamPokemonList}
              contentContainerStyle={styles.contentRouteContent}
              showsVerticalScrollIndicator
            >
              {teamPokemon.map((pokemon, pokemonIndex) => (
                <View key={pokemonIndex} style={styles.teamPokemonRow}>
                  <Pressable
                    onPress={() => {
                      setTeamPokemonMenuIndex(
                        teamPokemonMenuIndex === pokemonIndex
                          ? null
                          : pokemonIndex,
                      );
                      setTeamPokemonSearch("");
                    }}
                    style={styles.pokemonDropdown}
                  >
                    <ThemedText type="small">
                      {pokemon.name
                        ? formatPokemonName(pokemon.name)
                        : pokemonLoading
                          ? "Loading..."
                          : "Select Pokemon"}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setTeamPokemon((currentPokemon) =>
                        currentPokemon.filter(
                          (_, index) => index !== pokemonIndex,
                        ),
                      )
                    }
                    style={styles.removeRouteButton}
                  >
                    <ThemedText type="smallBold">Remove</ThemedText>
                  </Pressable>
                  {teamPokemonMenuIndex === pokemonIndex ? (
                    <ScrollView style={styles.teamPokemonOptions}>
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={setTeamPokemonSearch}
                        placeholder="Search Pokemon"
                        placeholderTextColor="rgba(255, 255, 255, 0.6)"
                        style={styles.pokemonSearch}
                        value={teamPokemonSearch}
                      />
                      {pokemonOptions
                        .filter((option) =>
                          option.name.includes(teamPokemonSearch.toLowerCase()),
                        )
                        .map((option) => (
                          <Pressable
                            key={option.name}
                            onPress={() => {
                              updateTeamPokemon(pokemonIndex, {
                                name: option.name,
                              });
                              setTeamPokemonMenuIndex(null);
                              setTeamPokemonSearch("");
                            }}
                            style={styles.pokemonOption}
                          >
                            <ThemedText type="small">
                              {formatPokemonName(option.name)}
                            </ThemedText>
                          </Pressable>
                        ))}
                    </ScrollView>
                  ) : null}
                  {pokemon.name ? (
                    <View style={styles.movesList}>
                      <ThemedText type="smallBold">Moves</ThemedText>
                      {pokemon.moves.map((move, moveIndex) => (
                        <TextInput
                          key={moveIndex}
                          onChangeText={(value) =>
                            updateTeamMove(pokemonIndex, moveIndex, value)
                          }
                          placeholder={`Move ${moveIndex + 1}`}
                          placeholderTextColor="rgba(255, 255, 255, 0.6)"
                          style={styles.input}
                          value={move}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={addTeamPokemon}
              disabled={teamPokemon.length >= MAX_TEAM_POKEMON}
              style={({ pressed }) => [
                styles.createMenuButton,
                teamPokemon.length >= MAX_TEAM_POKEMON && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">
                {teamPokemon.length >= MAX_TEAM_POKEMON
                  ? "Pokemon Limit Reached"
                  : "Add Pokemon"}
              </ThemedText>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable
                onPress={saveTeam}
                style={({ pressed }) => [
                  styles.createMenuButton,
                  styles.actionButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Save</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setTeamMenuVisible(false)}
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

      <Modal
        animationType="fade"
        onRequestClose={() => setEliteMemberMenuVisible(false)}
        transparent
        visible={eliteMemberMenuVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.gymEditMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {eliteCreationKind === "champion"
                ? "Add Champion"
                : eliteCreationKind === "eliteFour"
                  ? "Add Elite 4"
                  : editingEliteKind === "champion"
                    ? "Edit Champion"
                    : "Edit Elite 4"}
            </ThemedText>
            {eliteCreationKind !== null ? (
              eliteCreationNames.map((name, index) => (
                <View key={index} style={styles.fieldGroup}>
                  <ThemedText type="smallBold">
                    {eliteCreationKind === "champion"
                      ? "Champion Name"
                      : `Elite Member ${index + 1}`}
                  </ThemedText>
                  <TextInput
                    placeholder={
                      eliteCreationKind === "champion"
                        ? "e.g. Blue"
                        : "e.g. Lorelei"
                    }
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    onChangeText={(value) =>
                      setEliteCreationNames((currentNames) =>
                        currentNames.map((currentName, currentIndex) =>
                          currentIndex === index ? value : currentName,
                        ),
                      )
                    }
                    style={styles.input}
                    value={name}
                  />
                </View>
              ))
            ) : (
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">
                  {editingEliteKind === "champion"
                    ? "Champion Name"
                    : "Elite 4 Name"}
                </ThemedText>
                <TextInput
                  placeholder={
                    editingEliteKind === "champion"
                      ? "e.g. Champion Blue"
                      : "e.g. Lorelei"
                  }
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  onChangeText={setEliteMemberName}
                  style={styles.input}
                  value={eliteMemberName}
                />
              </View>
            )}
            <Pressable
              onPress={saveEliteMember}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">
                {eliteCreationKind !== null ? "Add" : "Save Changes"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setEliteMemberMenuVisible(false)}
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
            <DetailInput
              label="Terrain"
              value={routeDetails.terrain}
              onChangeText={(value) =>
                setRouteDetails((current) => ({ ...current, terrain: value }))
              }
            />
            <DetailInput
              label="Difficulty"
              value={routeDetails.difficulty}
              onChangeText={(value) =>
                setRouteDetails((current) => ({
                  ...current,
                  difficulty: value,
                }))
              }
            />
            <DetailInput
              label="Items"
              value={routeDetails.items}
              onChangeText={(value) =>
                setRouteDetails((current) => ({ ...current, items: value }))
              }
            />
            <DetailInput
              label="Trainers"
              value={routeDetails.trainers}
              onChangeText={(value) =>
                setRouteDetails((current) => ({
                  ...current,
                  trainers: value,
                }))
              }
            />
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

function DetailInput({
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
    maxWidth: 720,
    maxHeight: "92%",
    gap: 16,
    padding: 24,
    borderRadius: 16,
  },
  contentMenuScroll: {
    flexShrink: 1,
  },
  contentMenuScrollContent: {
    gap: 16,
    paddingBottom: 4,
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
  contentDropdownHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  contentDropdownContent: {
    gap: 12,
    paddingTop: 4,
  },
  gymActions: {
    flexDirection: "row",
    gap: 8,
  },
  gymActionButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  mapCanvas: {
    height: 540,
    overflow: "hidden",
    position: "relative",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "#6b9f67",
  },
  mapWater: {
    position: "absolute",
    top: -24,
    right: -22,
    width: 188,
    height: 168,
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 44,
    backgroundColor: "rgba(77, 157, 190, 0.72)",
  },
  mapForest: {
    position: "absolute",
    bottom: -34,
    left: -18,
    width: 188,
    height: 130,
    borderTopRightRadius: 110,
    backgroundColor: "rgba(38, 104, 62, 0.72)",
  },
  mapHighlands: {
    position: "absolute",
    top: 136,
    left: 190,
    width: 170,
    height: 88,
    borderRadius: 60,
    backgroundColor: "rgba(168, 145, 88, 0.26)",
    transform: [{ rotate: "-10deg" }],
  },
  routeMapPiece: {
    position: "absolute",
    width: 92,
    height: 62,
  },
  routeConnector: {
    position: "absolute",
    height: 14,
    borderRadius: 8,
    backgroundColor: "#b88b52",
    borderWidth: 2,
    borderColor: "rgba(91, 61, 31, 0.28)",
  },
  routePathSegmentA: {
    position: "absolute",
    top: 28,
    left: -12,
    width: 54,
    height: 12,
    borderRadius: 12,
    backgroundColor: "#c49b62",
    transform: [{ rotate: "22deg" }],
  },
  routePathSegmentB: {
    position: "absolute",
    top: 16,
    left: 22,
    width: 52,
    height: 12,
    borderRadius: 12,
    backgroundColor: "#d2ad72",
    transform: [{ rotate: "-18deg" }],
  },
  routePathSegmentC: {
    position: "absolute",
    top: 30,
    left: 54,
    width: 52,
    height: 12,
    borderRadius: 12,
    backgroundColor: "#b88b52",
    transform: [{ rotate: "28deg" }],
  },
  routePathLabel: {
    position: "absolute",
    top: 0,
    left: 12,
    maxWidth: 72,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(73, 52, 30, 0.78)",
  },
  gymMapPiece: {
    position: "absolute",
    width: 58,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  gymEmoji: {
    fontSize: 34,
    lineHeight: 38,
  },
  gymIndex: {
    minWidth: 22,
    textAlign: "center",
    color: "#fff5ca",
    textShadowColor: "rgba(64, 39, 18, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gymCountMenu: {
    width: "100%",
    maxWidth: 440,
    gap: 16,
    padding: 24,
    borderRadius: 16,
  },
  gymCountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  gymCountOption: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  gymEditMenu: {
    width: "100%",
    maxWidth: 480,
    gap: 16,
    padding: 24,
    borderRadius: 16,
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
  teamButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  teamMenu: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    gap: 16,
    padding: 24,
    borderRadius: 16,
  },
  teamPokemonList: {
    maxHeight: 560,
  },
  teamPokemonRow: {
    gap: 8,
    paddingBottom: 12,
  },
  teamPokemonOptions: {
    maxHeight: 220,
    borderRadius: 8,
    backgroundColor: "#212225",
  },
  movesList: {
    gap: 8,
    paddingLeft: 12,
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
