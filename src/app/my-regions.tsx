import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useLocalSearchParams } from "expo-router";
import { createElement, useEffect, useRef, useState } from "react";
import {
    Animated,
    Linking,
    Modal,
    Pressable,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
    Share,
} from "react-native";

import { getPokemon, type Pokemon } from "@/api/pokemon";
import {
  confirmDeleteAction as confirmDeletePrompt,
} from "@/utils/delete-confirmation";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import {
  getMusicEmbedUri,
  getMusicProvider,
  normalizeMusicUri,
} from "@/utils/music";
import {
  createCommentResponseLink,
  createRegionShareLink,
  decodeSharedRegion,
  type RegionSharePermission,
} from "@/utils/region-sharing";
import {
  buildLiveShareLink,
  generateRoomCode,
  isLiveShareSupported,
  LiveShareSession,
  type LiveShareStatus,
} from "@/utils/region-peer-share";
import {
  checkAuthStatus,
  fetchCloudData,
  getAuthToken,
  loginUser,
  logoutUser,
  pushCloudData,
  registerUser,
  type User,
} from "@/utils/account-sync";

const APP_STORAGE_VERSION = "v2";
const REGIONS_STORAGE_KEY = `pokemon-regions-${APP_STORAGE_VERSION}`;
const CUSTOM_POKEMON_STORAGE_KEY = `custom-pokemon-options-${APP_STORAGE_VERSION}`;
const GIMMICKS_STORAGE_KEY = "pokemon-gimmicks";
const LEGACY_STORAGE_KEYS = ["pokemon-regions", "custom-pokemon-options"];
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
  gimmicks: string[];
  music: MusicEntry[];
  sharePermission?: RegionSharePermission;
  sharedComments?: string[];
  liveRoomCode?: string;
};
type MusicEntry = {
  name: string;
  uri: string;
  kind: "audio" | "sheet" | "file";
};
type Gimmick = {
  name: string;
  category: string;
  description: string;
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

function countAssignedPokemon(
  teams: TeamPokemon[][],
  routePokemon: Record<string, RoutePokemon[]>,
) {
  const routeCount = Object.values(routePokemon).reduce(
    (total, entries) => total + entries.filter((entry) => entry.name).length,
    0,
  );
  const teamCount = teams.reduce(
    (total, team) => total + team.filter((entry) => entry.name).length,
    0,
  );
  return routeCount + teamCount;
}

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

function ShareGlyph({ color }: { color: string }) {
  return (
    <View style={styles.shareGlyph} accessible={false}>
      <View style={[styles.shareLineTop, { backgroundColor: color }]} />
      <View style={[styles.shareLineBottom, { backgroundColor: color }]} />
      <View style={[styles.shareNode, styles.shareNodeLeft, { backgroundColor: color }]} />
      <View style={[styles.shareNode, styles.shareNodeTop, { backgroundColor: color }]} />
      <View style={[styles.shareNode, styles.shareNodeBottom, { backgroundColor: color }]} />
    </View>
  );
}

export default function MyRegionsScreen() {
  const params = useLocalSearchParams<{
    sharedRegion?: string;
    permission?: string;
    live?: string;
    comment?: string;
    commentResponse?: string;
  }>();
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
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [gymsExpanded, setGymsExpanded] = useState(false);
  const [eliteFourExpanded, setEliteFourExpanded] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [gimmicksExpanded, setGimmicksExpanded] = useState(false);
  const [musicExpanded, setMusicExpanded] = useState(false);
  const [musicEntries, setMusicEntries] = useState<MusicEntry[]>([]);
  const [musicEditorVisible, setMusicEditorVisible] = useState(false);
  const [musicName, setMusicName] = useState("");
  const [musicUri, setMusicUri] = useState("");
  const [musicKind, setMusicKind] = useState<MusicEntry["kind"]>("sheet");
  const [availableGimmicks, setAvailableGimmicks] = useState<Gimmick[]>([]);
  const [selectedGimmicks, setSelectedGimmicks] = useState<string[]>([]);
  const [gimmickCreateVisible, setGimmickCreateVisible] = useState(false);
  const [newGimmickName, setNewGimmickName] = useState("");
  const [newGimmickCategory, setNewGimmickCategory] = useState("");
  const [newGimmickDescription, setNewGimmickDescription] = useState("");
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
  const [importExportVisible, setImportExportVisible] = useState(false);
  const [importExportMode, setImportExportMode] = useState<
    "import" | "export" | null
  >(null);
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");
  const [importError, setImportError] = useState("");
  const [shareVisible, setShareVisible] = useState(false);
  const [shareRegionIndex, setShareRegionIndex] = useState<number | null>(null);
  const [sharePermission, setSharePermission] =
    useState<RegionSharePermission>("view");
  const [shareComment, setShareComment] = useState("");
  const [sharedComment, setSharedComment] = useState("");
  const [sharedPermission, setSharedPermission] =
    useState<RegionSharePermission | null>(null);
  const [isCommentResponse, setIsCommentResponse] = useState(false);
  const [commentEditorVisible, setCommentEditorVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSentMessage, setCommentSentMessage] = useState("");
  const [shareMode, setShareMode] = useState<"link" | "live">("link");
  const [liveShareStatus, setLiveShareStatus] = useState<
    LiveShareStatus | "idle"
  >("idle");
  const [liveShareLink, setLiveShareLink] = useState("");
  const [liveActivity, setLiveActivity] = useState<string[]>([]);
  const liveSessionRef = useRef<LiveShareSession | null>(null);
  const [liveGuestPermission, setLiveGuestPermission] =
    useState<RegionSharePermission | null>(null);
  const [guestCommentDraft, setGuestCommentDraft] = useState("");
  const [guestCommentSent, setGuestCommentSent] = useState(false);
  const [guestEditMessage, setGuestEditMessage] = useState("");

  // Account & Cloud Sync State
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const theme = useTheme();

  function stopLiveShare() {
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    setLiveShareStatus("idle");
    setLiveShareLink("");
    setLiveActivity([]);
  }

  function startLiveShare() {
    if (shareRegionIndex === null || !isLiveShareSupported()) return;
    const regionIndex = shareRegionIndex;
    const roomCode = generateRoomCode();
    setLiveShareLink(buildLiveShareLink(roomCode, sharePermission));
    setLiveActivity([]);
    setLiveShareStatus("connecting");

    const session = new LiveShareSession(roomCode, "host");
    session.onStatus = (status) => {
      setLiveShareStatus(status);
      if (status === "connected") {
        session.send({ type: "region", region: regions[regionIndex] });
        setLiveActivity((prev) => [...prev, "Connected. Region sent."]);
      }
      if (status === "closed" || status === "error") {
        setLiveActivity((prev) => [
          ...prev,
          status === "error" ? "Connection error." : "Connection closed.",
        ]);
      }
    };
    session.onMessage = (message) => {
      if (message.type === "comment") {
        setLiveActivity((prev) => [...prev, `Comment: ${message.text}`]);
      } else if (message.type === "edit") {
        setRegions((current) => {
          if (!current[regionIndex]) return current;
          const next = [...current];
          next[regionIndex] = {
            ...(message.region as Region),
            liveRoomCode: undefined,
          };
          return next;
        });
        setLiveActivity((prev) => [
          ...prev,
          "The other device sent updated region changes.",
        ]);
      }
    };
    liveSessionRef.current = session;
    session.connect();
  }

  async function copyLiveShareLink() {
    if (!liveShareLink) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      await navigator.clipboard?.writeText(liveShareLink);
      return;
    }
    await Share.share({ message: liveShareLink, title: "Live Share Link" });
  }

  function sendGuestComment() {
    const text = guestCommentDraft.trim();
    if (!text || !liveSessionRef.current) return;
    const sent = liveSessionRef.current.send({ type: "comment", text });
    if (sent) {
      setGuestCommentDraft("");
      setGuestCommentSent(true);
      setTimeout(() => setGuestCommentSent(false), 3000);
    }
  }

  function sendGuestEdits(region: Region) {
    if (!liveSessionRef.current) return;
    const { liveRoomCode: _omit, ...rest } = region;
    const sent = liveSessionRef.current.send({ type: "edit", region: rest });
    setGuestEditMessage(
      sent ? "Changes sent to the region owner." : "Not connected yet.",
    );
    if (sent) setTimeout(() => setGuestEditMessage(""), 3000);
  }

  useEffect(() => {
    return () => {
      liveSessionRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const encodedRegion = Array.isArray(params.sharedRegion)
      ? params.sharedRegion[0]
      : params.sharedRegion;
    if (!encodedRegion || !hasLoadedRegions) return;

    try {
      const shared = decodeSharedRegion(encodedRegion);
      const permission =
        params.permission === "edit" || params.permission === "comment"
          ? params.permission
          : "view";
      const importedRegion = {
        name: String(shared.name ?? "Shared Region"),
        rivalName: String(shared.rivalName ?? ""),
        type: String(shared.type ?? ""),
        routes: String(shared.routes ?? ""),
        routeNames: Array.isArray(shared.routeNames) ? shared.routeNames : [],
        routePokemon:
          (shared.routePokemon as Record<string, RoutePokemon[]>) ?? {},
        routeDetails:
          (shared.routeDetails as Record<string, RouteDetails>) ?? {},
        gyms: Array.isArray(shared.gyms) ? shared.gyms : [],
        gymDetails: Array.isArray(shared.gymDetails) ? shared.gymDetails : [],
        gymPokemon: Array.isArray(shared.gymPokemon) ? shared.gymPokemon : [],
        eliteFour: Array.isArray(shared.eliteFour) ? shared.eliteFour : [],
        eliteFourPokemon: Array.isArray(shared.eliteFourPokemon)
          ? shared.eliteFourPokemon
          : [],
        champion: typeof shared.champion === "string" ? shared.champion : null,
        championPokemon: Array.isArray(shared.championPokemon)
          ? shared.championPokemon
          : [],
        mapPositions: (shared.mapPositions as Record<string, MapPosition>) ?? {},
        gimmicks: Array.isArray(shared.gimmicks) ? shared.gimmicks : [],
        music: Array.isArray(shared.music) ? shared.music : [],
        sharePermission: permission,
        sharedComments: [],
      } satisfies Region;
      setRegions((currentRegions) => [...currentRegions, importedRegion]);
    } catch {
      setImportError("This shared region link is invalid or incomplete.");
    }
  }, [hasLoadedRegions, params.permission, params.sharedRegion]);

  useEffect(() => {
    const encodedRegion = Array.isArray(params.sharedRegion)
      ? params.sharedRegion[0]
      : params.sharedRegion;
    if (!encodedRegion) return;

    setIsCommentResponse(params.commentResponse === "1");
    const permission = params.permission;
    if (
      permission === "view" ||
      permission === "edit" ||
      permission === "comment"
    ) {
      setSharedPermission(permission);
    }
    const comment = Array.isArray(params.comment)
      ? params.comment[0]
      : params.comment;
    if (comment) setSharedComment(comment);
  }, [
    params.comment,
    params.commentResponse,
    params.permission,
    params.sharedRegion,
  ]);

  useEffect(() => {
    const roomCode = Array.isArray(params.live) ? params.live[0] : params.live;
    if (!roomCode || !hasLoadedRegions || !isLiveShareSupported()) return;
    if (liveSessionRef.current) return;

    const permission =
      params.permission === "edit" || params.permission === "comment"
        ? params.permission
        : "view";
    setLiveGuestPermission(permission);
    setLiveShareStatus("connecting");

    const session = new LiveShareSession(roomCode, "guest");
    session.onStatus = setLiveShareStatus;
    session.onMessage = (message) => {
      if (message.type !== "region") return;
      const shared = message.region as Record<string, unknown>;
      const importedRegion = {
        name: String(shared.name ?? "Shared Region"),
        rivalName: String(shared.rivalName ?? ""),
        type: String(shared.type ?? ""),
        routes: String(shared.routes ?? ""),
        routeNames: Array.isArray(shared.routeNames) ? shared.routeNames : [],
        routePokemon:
          (shared.routePokemon as Record<string, RoutePokemon[]>) ?? {},
        routeDetails:
          (shared.routeDetails as Record<string, RouteDetails>) ?? {},
        gyms: Array.isArray(shared.gyms) ? shared.gyms : [],
        gymDetails: Array.isArray(shared.gymDetails) ? shared.gymDetails : [],
        gymPokemon: Array.isArray(shared.gymPokemon) ? shared.gymPokemon : [],
        eliteFour: Array.isArray(shared.eliteFour) ? shared.eliteFour : [],
        eliteFourPokemon: Array.isArray(shared.eliteFourPokemon)
          ? shared.eliteFourPokemon
          : [],
        champion: typeof shared.champion === "string" ? shared.champion : null,
        championPokemon: Array.isArray(shared.championPokemon)
          ? shared.championPokemon
          : [],
        mapPositions: (shared.mapPositions as Record<string, MapPosition>) ?? {},
        gimmicks: Array.isArray(shared.gimmicks) ? shared.gimmicks : [],
        music: Array.isArray(shared.music) ? shared.music : [],
        sharePermission: permission,
        sharedComments: [],
        liveRoomCode: roomCode,
      } satisfies Region;
      setRegions((current) => {
        const existingIndex = current.findIndex(
          (region) => region.liveRoomCode === roomCode,
        );
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = importedRegion;
          return next;
        }
        return [...current, importedRegion];
      });
    };
    liveSessionRef.current = session;
    session.connect();
  }, [hasLoadedRegions, params.live, params.permission]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    LEGACY_STORAGE_KEYS.forEach((key) => {
      if (window.localStorage.getItem(key)) {
        window.localStorage.removeItem(key);
      }
    });

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
            gimmicks: Array.isArray(region.gimmicks) ? region.gimmicks : [],
            music: Array.isArray(region.music) ? region.music : [],
            sharePermission: region.sharePermission,
            sharedComments: Array.isArray(region.sharedComments)
              ? region.sharedComments
              : [],
            liveRoomCode: region.liveRoomCode,
          })),
        );
      } catch {
        window.localStorage.removeItem(REGIONS_STORAGE_KEY);
      }
    }
    setHasLoadedRegions(true);
  }, []);

  function loadGimmicks() {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
    if (!stored) {
      setAvailableGimmicks([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<Gimmick>[];
      setAvailableGimmicks(
        parsed
          .filter((gimmick) => typeof gimmick?.name === "string")
          .map((gimmick) => ({
            name: gimmick.name?.trim() ?? "",
            category: gimmick.category ?? "",
            description: gimmick.description ?? "",
          })),
      );
    } catch {
      setAvailableGimmicks([]);
    }
  }

  function openGimmickSection() {
    loadGimmicks();
    setGimmicksExpanded((expanded) => !expanded);
  }

  function toggleGimmick(name: string) {
    const nextSelection = selectedGimmicks.includes(name)
      ? selectedGimmicks.filter((gimmickName) => gimmickName !== name)
      : [...selectedGimmicks, name];
    setSelectedGimmicks(nextSelection);
    saveRegionGimmicks(nextSelection);
  }

  function openGimmickCreate() {
    setNewGimmickName("");
    setNewGimmickCategory("");
    setNewGimmickDescription("");
    setContentMenuVisible(false);
    setGimmickCreateVisible(true);
  }

  function saveNewGimmick() {
    const name = newGimmickName.trim();
    if (!name || typeof window === "undefined") return;
    const gimmick = {
      name,
      category: newGimmickCategory.trim(),
      description: newGimmickDescription.trim(),
    };
    const next = [...availableGimmicks.filter((item) => item.name !== name), gimmick];
    window.localStorage.setItem(GIMMICKS_STORAGE_KEY, JSON.stringify(next));
    setAvailableGimmicks(next);
    const nextSelection = selectedGimmicks.includes(name)
      ? selectedGimmicks
      : [...selectedGimmicks, name];
    setSelectedGimmicks(nextSelection);
    saveRegionGimmicks(nextSelection);
    setGimmickCreateVisible(false);
    setGimmicksExpanded(true);
    setContentMenuVisible(true);
  }

  function saveRegionGimmicks(nextGimmicks = selectedGimmicks) {
    if (contentRegionIndex === null) return;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex
          ? { ...region, gimmicks: nextGimmicks }
          : region,
      ),
    );
  }

  function saveMusic(nextMusic: MusicEntry[]) {
    if (contentRegionIndex === null) return;
    setMusicEntries(nextMusic);
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex ? { ...region, music: nextMusic } : region,
      ),
    );
  }

  function openMusicEditor() {
    setMusicName("");
    setMusicUri("");
    setMusicKind("sheet");
    setContentMenuVisible(false);
    setMusicEditorVisible(true);
  }

  function chooseMusicFile() {
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
        setMusicUri(String(reader.result ?? ""));
        setMusicKind(file.type.startsWith("audio/") ? "audio" : "sheet");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function saveMusicEntry() {
    const name = musicName.trim();
    const uri = normalizeMusicUri(musicUri);
    if (!name || !uri) return;
    saveMusic([
      ...musicEntries,
      { name, uri, kind: getMusicProvider(uri) ? "sheet" : musicKind },
    ]);
    setMusicEditorVisible(false);
    setMusicExpanded(true);
    setContentMenuVisible(true);
  }

  function removeMusicEntry(index: number) {
    saveMusic(musicEntries.filter((_, entryIndex) => entryIndex !== index));
  }

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoadedRegions) {
      window.localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(regions));
    }
  }, [hasLoadedRegions, regions]);

  useEffect(() => {
    checkAuthStatus().then((user) => {
      setAuthUser(user);
      if (user) {
        void handleCloudSync("auto");
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoadedRegions && authUser) {
      const timer = setTimeout(() => {
        let customPkmn: any[] = [];
        let gimmicksList: any[] = [];
        try {
          const storedP = window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY);
          if (storedP) customPkmn = JSON.parse(storedP);
          const storedG = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
          if (storedG) gimmicksList = JSON.parse(storedG);
        } catch {}
        void pushCloudData({ regions, customPokemon: customPkmn, gimmicks: gimmicksList });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasLoadedRegions, regions, authUser]);

  async function handleCloudSync(mode: "auto" | "pull" | "push" = "auto") {
    if (!getAuthToken()) return;
    setSyncStatus("Syncing with Cloudflare...");

    if (mode === "push") {
      let customPkmn: any[] = [];
      let gimmicksList: any[] = [];
      if (typeof window !== "undefined") {
        try {
          const storedP = window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY);
          if (storedP) customPkmn = JSON.parse(storedP);
          const storedG = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
          if (storedG) gimmicksList = JSON.parse(storedG);
        } catch {}
      }
      const res = await pushCloudData({ regions, customPokemon: customPkmn, gimmicks: gimmicksList });
      if (res.success) {
        setSyncStatus("Pushed to Cloudflare!");
      } else {
        setSyncStatus(`Sync error: ${res.error}`);
      }
      return;
    }

    const res = await fetchCloudData();
    if (!res.success || !res.data) {
      setSyncStatus(`Sync error: ${res.error || "Could not fetch cloud data"}`);
      return;
    }

    const cloudRegions = res.data.regions || [];
    const cloudCustomPokemon = res.data.customPokemon || [];
    const cloudGimmicks = res.data.gimmicks || [];

    if (mode === "pull" || (mode === "auto" && cloudRegions.length > 0 && regions.length === 0)) {
      if (cloudRegions.length > 0) setRegions(cloudRegions);
      if (typeof window !== "undefined") {
        if (cloudCustomPokemon.length > 0) {
          window.localStorage.setItem(CUSTOM_POKEMON_STORAGE_KEY, JSON.stringify(cloudCustomPokemon));
        }
        if (cloudGimmicks.length > 0) {
          window.localStorage.setItem(GIMMICKS_STORAGE_KEY, JSON.stringify(cloudGimmicks));
        }
      }
      setSyncStatus("Pulled from Cloudflare!");
    } else if (mode === "auto") {
      const mergedMap = new Map<string, Region>();
      cloudRegions.forEach((r: Region) => { if (r.name) mergedMap.set(r.name, r); });
      regions.forEach((r: Region) => { if (r.name) mergedMap.set(r.name, r); });
      const mergedRegions = Array.from(mergedMap.values());
      setRegions(mergedRegions);

      let customPkmn = cloudCustomPokemon;
      let gimmicksList = cloudGimmicks;
      if (typeof window !== "undefined") {
        try {
          const storedP = window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY);
          if (storedP) customPkmn = JSON.parse(storedP);
          const storedG = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
          if (storedG) gimmicksList = JSON.parse(storedG);
        } catch {}
      }
      await pushCloudData({ regions: mergedRegions, customPokemon: customPkmn, gimmicks: gimmicksList });
      setSyncStatus("Synced with Cloudflare!");
    }
  }

  async function handleLogin() {
    if (!authUsername.trim() || !authPassword) {
      setAuthError("Please fill in all fields");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    const res = await loginUser(authUsername.trim(), authPassword);
    setAuthLoading(false);
    if (res.success && res.user) {
      setAuthUser(res.user);
      setAuthSuccess(`Welcome back, ${res.user.username}!`);
      setAuthPassword("");
      void handleCloudSync("auto");
    } else {
      setAuthError(res.error || "Login failed");
    }
  }

  async function handleRegister() {
    if (!authUsername.trim() || !authPassword) {
      setAuthError("Please fill in all fields");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    const res = await registerUser(authUsername.trim(), authPassword);
    setAuthLoading(false);
    if (res.success && res.user) {
      setAuthUser(res.user);
      setAuthSuccess(`Account created! Welcome, ${res.user.username}!`);
      setAuthPassword("");
      void handleCloudSync("push");
    } else {
      setAuthError(res.error || "Registration failed");
    }
  }

  async function handleLogout() {
    await logoutUser();
    setAuthUser(null);
    setAuthSuccess("Logged out successfully.");
    setSyncStatus("");
  }

  const loadPokemonOptions = async () => {
    setPokemonLoading(true);

    try {
      const basePokemon = await getPokemon(1025);
      let customPokemon: Pokemon[] = [];

      if (typeof window !== "undefined") {
        const storedCustom =
          window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY) ??
          window.localStorage.getItem("custom-pokemon-options");

        if (storedCustom) {
          try {
            const parsed = JSON.parse(storedCustom) as Partial<Pokemon & {
              imageUrl?: string;
              isCustom?: boolean;
            }>[];
            customPokemon = parsed
              .filter(
                (entry): entry is Partial<Pokemon> & { name: string } =>
                  !!entry && typeof entry.name === "string",
              )
              .map((entry) => ({
                name: entry.name,
                url: entry.imageUrl ?? entry.url ?? "",
                types: Array.isArray(entry.types) ? entry.types : [],
                generation: typeof entry.generation === "number" ? entry.generation : 9,
                imageUrl: entry.imageUrl ?? entry.url ?? "",
                isCustom: true,
              }));

            if (
              !window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY) &&
              window.localStorage.getItem("custom-pokemon-options")
            ) {
              window.localStorage.setItem(
                CUSTOM_POKEMON_STORAGE_KEY,
                storedCustom,
              );
            }
          } catch {
            window.localStorage.removeItem(CUSTOM_POKEMON_STORAGE_KEY);
            window.localStorage.removeItem("custom-pokemon-options");
          }
        }
      }

      setPokemonOptions([...basePokemon, ...customPokemon]);
    } catch {
      setPokemonOptions([]);
    } finally {
      setPokemonLoading(false);
    }
  };

  useEffect(() => {
    void loadPokemonOptions();
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
    const positions = regions[index]?.mapPositions ?? {};
    setMapPositions(positions);
    mapPositionsRef.current = positions;
    setRoutesExpanded(false);
    setGymsExpanded(false);
    setEliteFourExpanded(false);
    setGimmicksExpanded(false);
    setMusicExpanded(false);
    setMapExpanded(false);
    setSelectedGimmicks(regions[index]?.gimmicks ?? []);
    setMusicEntries(regions[index]?.music ?? []);
    setGymCountMenuVisible(false);
    setContentMenuVisible(true);
  }

  function toggleContentSection(
    section: "routes" | "gyms" | "eliteFour" | "gimmicks" | "music" | "map",
  ) {
    const isOpen =
      section === "routes"
        ? routesExpanded
        : section === "gyms"
          ? gymsExpanded
          : section === "eliteFour"
            ? eliteFourExpanded
              : section === "gimmicks"
                ? gimmicksExpanded
                : section === "music"
                  ? musicExpanded
                : mapExpanded;

    if (!isOpen) {
      contentReveal.stopAnimation();
      contentReveal.setValue(0);
      Animated.timing(contentReveal, {
        toValue: 1,
        duration: 680,
        easing: undefined,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }

    setRoutesExpanded(section === "routes" ? (expanded) => !expanded : false);
    setGymsExpanded(section === "gyms" ? (expanded) => !expanded : false);
    setEliteFourExpanded(
      section === "eliteFour" ? (expanded) => !expanded : false,
    );
    setGimmicksExpanded(
      section === "gimmicks" ? (expanded) => !expanded : false,
    );
    setMusicExpanded(section === "music" ? (expanded) => !expanded : false);
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
          gymPokemon: [
            ...(region.gymPokemon ?? []),
            ...Array.from({ length: numberToAdd }, () => []),
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
          gymDetails: region.gymDetails.filter(
            (_, currentIndex) => currentIndex !== gymIndex,
          ),
          gymPokemon: region.gymPokemon.filter(
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
    void loadPokemonOptions();
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

  function resetPokemonFilters() {
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
        gimmicks: [],
        music: [],
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
              ...region,
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
              gimmicks: region.gimmicks ?? [],
              music: region.music ?? [],
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

  function confirmRegionDelete() {
    if (editingRegionIndex === null) return;
    confirmDeletePrompt(
      {
        title: "Delete region?",
        message:
          "This will remove the region and all of its saved route, gym, and leader data.",
        onConfirm: deleteRegion,
      },
    );
  }

  function openExportModal() {
    setImportText("");
    setImportError("");
    setExportText(
      JSON.stringify(
        { version: 2, exportedAt: new Date().toISOString(), regions },
        null,
        2,
      ),
    );
    setImportExportMode("export");
    setImportExportVisible(true);
  }

  function openImportModal() {
    setExportText("");
    setImportError("");
    setImportText("");
    setImportExportMode("import");
    setImportExportVisible(true);
  }

  function normalizeImportedRegions(rawInput: unknown): Region[] {
    const payload =
      Array.isArray(rawInput) ? rawInput :
      rawInput && typeof rawInput === "object" && Array.isArray((rawInput as { regions?: unknown }).regions)
        ? (rawInput as { regions: unknown[] }).regions
        : [];

    if (payload.length === 0) {
      throw new Error("Paste a valid region export or array of regions.");
    }

    return payload.map((entry, index) => {
      const region = (entry ?? {}) as Partial<Region>;
      if (!region || typeof region !== "object") {
        throw new Error(`Region ${index + 1} is not valid.`);
      }

      return {
        name: typeof region.name === "string" ? region.name : "",
        rivalName: typeof region.rivalName === "string" ? region.rivalName : "",
        type: typeof region.type === "string" ? region.type : "",
        routes: typeof region.routes === "string" ? region.routes : String(region.routes ?? ""),
        routeNames: Array.isArray(region.routeNames) ? region.routeNames : [],
        routePokemon:
          region.routePokemon && typeof region.routePokemon === "object"
            ? (region.routePokemon as Record<string, RoutePokemon[]>)
            : {},
        routeDetails:
          region.routeDetails && typeof region.routeDetails === "object"
            ? (region.routeDetails as Record<string, RouteDetails>)
            : {},
        gyms: Array.isArray(region.gyms) ? region.gyms : [],
        gymDetails: Array.isArray(region.gymDetails)
          ? region.gymDetails
          : [],
        gymPokemon: Array.isArray(region.gymPokemon) ? region.gymPokemon : [],
        eliteFour: Array.isArray(region.eliteFour) ? region.eliteFour : [],
        eliteFourPokemon: Array.isArray(region.eliteFourPokemon)
          ? region.eliteFourPokemon
          : [],
        champion:
          typeof region.champion === "string" || region.champion === null
            ? region.champion
            : null,
        championPokemon: Array.isArray(region.championPokemon)
          ? region.championPokemon
          : [],
        mapPositions:
          region.mapPositions && typeof region.mapPositions === "object"
            ? (region.mapPositions as Record<string, MapPosition>)
            : {},
        gimmicks: Array.isArray(region.gimmicks) ? region.gimmicks : [],
        music: Array.isArray(region.music) ? region.music : [],
      };
    });
  }

  function importRegions() {
    if (!importText.trim()) {
      setImportError("Paste a region export before importing.");
      return;
    }

    try {
      const parsed = JSON.parse(importText) as unknown;
      const nextRegions = normalizeImportedRegions(parsed);
      setRegions(nextRegions);
      setImportExportVisible(false);
      setImportText("");
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed. Check that the file is a Pokemon Regions JSON export.",
      );
    }
  }

  function uploadRegionsFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setImportText(result);
      setImportError("");
      setImportExportMode("import");
      setImportExportVisible(true);
    };
    reader.onerror = () => {
      setImportError("Could not read the selected file.");
    };
    reader.readAsText(file);
  }

  function chooseImportFile() {
    if (typeof document === "undefined") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      uploadRegionsFromFile(file);
    };
    input.click();
  }

  async function copyExportData() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setImportError("Clipboard is unavailable on this device.");
      return;
    }

    await navigator.clipboard.writeText(exportText);
    setImportExportVisible(false);
  }

  function downloadExportData() {
    if (typeof document === "undefined") return;

    const content = new Blob([exportText], { type: "application/json" });
    const url = URL.createObjectURL(content);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pokemon-regions.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setImportExportVisible(false);
  }

  async function shareRegion() {
    if (shareRegionIndex === null) return;
    const link = createRegionShareLink(
      regions[shareRegionIndex],
      sharePermission,
      shareComment,
    );
    if (!link) return;

    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      await navigator.clipboard?.writeText(link);
      setShareVisible(false);
      return;
    }

    await Share.share({
      message: link,
      title: `Share ${regions[shareRegionIndex]?.name ?? "region"}`,
    });
    setShareVisible(false);
  }

  function saveSharedComment() {
    const comment = commentDraft.trim();
    if (!comment) return;
    setSharedComment(comment);
    setCommentDraft("");
    setCommentEditorVisible(false);
  }

  async function sendCommentToOwner() {
    if (!sharedComment || !regions[0]) return;
    const responseLink = createCommentResponseLink(regions[0], sharedComment);
    if (!responseLink) return;

    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      await navigator.clipboard?.writeText(responseLink);
      setCommentSentMessage(
        "Comment response link copied. Send it to the region owner so they can view your comment.",
      );
      return;
    }

    await Share.share({
      message: responseLink,
      title: "Comment response link",
    });
    setCommentSentMessage(
      "Comment response link opened. Send it to the region owner.",
    );
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
      {liveGuestPermission ? (
        <ThemedView type="backgroundElement" style={styles.liveGuestNotice}>
          <ThemedText type="smallBold">
            Live Shared Region —{" "}
            {liveShareStatus === "connected"
              ? "Connected"
              : liveShareStatus === "waiting-for-peer" ||
                  liveShareStatus === "connecting"
                ? "Connecting…"
                : liveShareStatus === "error"
                  ? "Connection error"
                  : "Disconnected"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This region syncs directly with the owner&apos;s device while
            this connection stays open. Nothing is stored on a server.
          </ThemedText>
          {liveGuestPermission === "comment" ? (
            <View style={styles.liveGuestActions}>
              <TextInput
                onChangeText={setGuestCommentDraft}
                placeholder="Add a comment"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={guestCommentDraft}
              />
              <Pressable
                onPress={sendGuestComment}
                disabled={!guestCommentDraft.trim()}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  !guestCommentDraft.trim() && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Send Comment</ThemedText>
              </Pressable>
              {guestCommentSent ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Comment sent ✓
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          {liveGuestPermission === "edit"
            ? (() => {
                const liveIndex = regions.findIndex(
                  (region) => region.liveRoomCode,
                );
                if (liveIndex < 0) return null;
                return (
                  <View style={styles.liveGuestActions}>
                    <Pressable
                      onPress={() => sendGuestEdits(regions[liveIndex])}
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        Send My Edits to Owner
                      </ThemedText>
                    </Pressable>
                    {guestEditMessage ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {guestEditMessage}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })()
            : null}
        </ThemedView>
      ) : null}
      {sharedPermission ? (
        <ThemedView type="backgroundElement" style={styles.liveGuestNotice}>
          <ThemedText type="smallBold">
            {isCommentResponse
              ? "Comment received"
              : `Shared access: ${
                  sharedPermission === "view"
                    ? "View only"
                    : sharedPermission === "comment"
                      ? "Can comment"
                      : "Can edit"
                }`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isCommentResponse
              ? "This comment was sent back in a response link. Save or copy it into your region notes as needed."
              : "This is a local shared copy. Permissions and comments travel with the link, but accounts and live synchronization are not available."}
          </ThemedText>
          {sharedComment ? (
            <ThemedText type="small">Comment: {sharedComment}</ThemedText>
          ) : null}
          {sharedPermission === "comment" && !isCommentResponse ? (
            <View style={styles.liveGuestActions}>
              <Pressable
                onPress={() => {
                  setCommentDraft(sharedComment);
                  setCommentEditorVisible(true);
                }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">
                  {sharedComment ? "Edit Comment" : "Add Comment"}
                </ThemedText>
              </Pressable>
              {sharedComment ? (
                <Pressable
                  onPress={() => void sendCommentToOwner()}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Send Comment Back</ThemedText>
                </Pressable>
              ) : null}
              {commentSentMessage ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {commentSentMessage}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </ThemedView>
      ) : null}

      <View style={styles.topHeaderBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAuthError("");
            setAuthSuccess("");
            setAccountModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.accountBadgeButton,
            authUser && styles.accountBadgeButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold">
            {authUser ? `☁️ ${authUser.username}` : "☁️ Cloud Sync / Sign In"}
          </ThemedText>
        </Pressable>
      </View>

      {regions.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText type="subtitle">Don&apos;t Have A Region?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyDescription}>
            Create a region to plan routes, gyms, teams, and your custom map.
          </ThemedText>
          <Pressable
            onPress={openCreateMenu}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundElement" style={styles.createButton}>
              <ThemedText type="smallBold">Make One Now</ThemedText>
            </ThemedView>
          </Pressable>
          <View style={styles.emptyImportExportActions}>
            <Pressable
              accessibilityRole="button"
              onPress={openImportModal}
              style={({ pressed }) => [
                styles.emptyImportExportButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Import Regions</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openExportModal}
              style={({ pressed }) => [
                styles.emptyImportExportButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Export Regions</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      ) : (
        <View style={styles.regionsSection}>
          <ThemedView type="backgroundElement" style={styles.regionsArea}>
            <View style={styles.regionList}>
              {regions.map((region, index) => (
                <View key={`${region.name}-${region.rivalName}-${index}`} style={styles.regionCard}>
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
                      {(!region.sharePermission ||
                        region.sharePermission === "edit") &&
                      (!region.liveRoomCode ||
                        !liveGuestPermission ||
                        liveGuestPermission === "edit") ? (
                        <Pressable
                          accessibilityLabel={`Share ${region.name}`}
                          accessibilityRole="button"
                          onPress={() => {
                            setShareRegionIndex(index);
                            setSharePermission("view");
                            setShareComment("");
                            setShareMode("link");
                            stopLiveShare();
                            setShareVisible(true);
                          }}
                          style={({ pressed }) => [
                            styles.iconActionButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ShareGlyph color={theme.text} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.regionMetaRow}>
                    <ThemedText type="small">
                      {region.routeNames?.length ?? 0} routes
                    </ThemedText>
                    <ThemedText type="small">
                      {region.gyms?.length ?? 0} gyms
                    </ThemedText>
                    <ThemedText type="small">
                      {region.gimmicks?.length ?? 0} gimmicks
                    </ThemedText>
                    <ThemedText type="small">
                      {countAssignedPokemon(
                        [
                          ...(region.gymPokemon ?? []),
                          ...(region.eliteFourPokemon ?? []),
                          region.championPokemon ?? [],
                        ],
                        region.routePokemon ?? {},
                      )} Pokémon assigned
                    </ThemedText>
                    {region.eliteFour?.length ? (
                      <ThemedText type="small">
                        {region.eliteFour.length} elite members
                      </ThemedText>
                    ) : null}
                  </View>
                  {region.gimmicks?.length ? (
                    <ThemedText type="small" style={styles.regionGimmickSummary}>
                      Gimmicks: {region.gimmicks.join(", ")}
                    </ThemedText>
                  ) : null}
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

      {regions.length > 0 ? (
        <View style={styles.footerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={chooseImportFile}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Upload</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={openImportModal}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Import</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={openExportModal}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Export</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAuthError("");
              setAuthSuccess("");
              setAccountModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">
              {authUser ? `☁️ ${authUser.username}` : "Cloud Account"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setShareVisible(false);
          stopLiveShare();
        }}
        transparent
        visible={shareVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.shareMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              Share {shareRegionIndex === null ? "Region" : regions[shareRegionIndex]?.name}
            </ThemedText>
            <View style={styles.shareModeOptions}>
              <Pressable
                onPress={() => setShareMode("link")}
                style={[
                  styles.shareModeOption,
                  shareMode === "link" && styles.selectedDropdown,
                ]}
              >
                <ThemedText type="smallBold">Share Link</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setShareMode("live")}
                style={[
                  styles.shareModeOption,
                  shareMode === "live" && styles.selectedDropdown,
                ]}
              >
                <ThemedText type="smallBold">Live Share (Beta)</ThemedText>
              </Pressable>
            </View>
            {shareMode === "link" ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  This creates a self-contained link. It is not real-time
                  collaboration; the recipient receives a local copy with the
                  selected permission.
                </ThemedText>
                <View style={styles.sharePermissionOptions}>
                  {(
                    [
                      ["view", "View only"],
                      ["comment", "Can comment"],
                      ["edit", "Can edit"],
                    ] as [RegionSharePermission, string][]
                  ).map(([permission, label]) => (
                    <Pressable
                      key={permission}
                      onPress={() => setSharePermission(permission)}
                      style={[
                        styles.sharePermissionOption,
                        sharePermission === permission &&
                          styles.selectedDropdown,
                      ]}
                    >
                      <ThemedText type="smallBold">{label}</ThemedText>
                    </Pressable>
                  ))}
                </View>
                {sharePermission === "comment" ? (
                  <TextInput
                    onChangeText={setShareComment}
                    placeholder="Optional starting comment"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.input}
                    value={shareComment}
                  />
                ) : null}
                <Pressable
                  onPress={() => void shareRegion()}
                  style={({ pressed }) => [
                    styles.createMenuButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    {Platform.OS === "web" ? "Copy Share Link" : "Share Link"}
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Live Share sends this region directly to another open
                  device over a temporary peer-to-peer connection. Only a
                  brief connection-setup message passes through our
                  signaling service; no region data is stored there.
                </ThemedText>
                {!isLiveShareSupported() ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Live Share is only available in the web version of this
                    app.
                  </ThemedText>
                ) : liveShareStatus === "idle" ? (
                  <>
                    <View style={styles.sharePermissionOptions}>
                      {(
                        [
                          ["view", "View only"],
                          ["comment", "Can comment"],
                          ["edit", "Can edit"],
                        ] as [RegionSharePermission, string][]
                      ).map(([permission, label]) => (
                        <Pressable
                          key={permission}
                          onPress={() => setSharePermission(permission)}
                          style={[
                            styles.sharePermissionOption,
                            sharePermission === permission &&
                              styles.selectedDropdown,
                          ]}
                        >
                          <ThemedText type="smallBold">{label}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      onPress={startLiveShare}
                      style={({ pressed }) => [
                        styles.createMenuButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        Start Live Share
                      </ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <ThemedText type="smallBold">
                      Status:{" "}
                      {liveShareStatus === "connected"
                        ? "Connected"
                        : liveShareStatus === "waiting-for-peer"
                          ? "Waiting for the other device…"
                          : liveShareStatus === "connecting"
                            ? "Connecting…"
                            : liveShareStatus === "error"
                              ? "Connection error"
                              : "Closed"}
                    </ThemedText>
                    {liveShareLink ? (
                      <Pressable
                        onPress={() => void copyLiveShareLink()}
                        style={({ pressed }) => [
                          styles.secondaryAction,
                          pressed && styles.pressed,
                        ]}
                      >
                        <ThemedText type="smallBold">
                          {Platform.OS === "web"
                            ? "Copy Live Share Link"
                            : "Share Live Link"}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                    {liveActivity.length > 0 ? (
                      <View style={styles.liveActivityList}>
                        <ThemedText type="smallBold">Activity</ThemedText>
                        {liveActivity.map((entry, entryIndex) => (
                          <ThemedText
                            key={entryIndex}
                            type="small"
                            themeColor="textSecondary"
                          >
                            {entry}
                          </ThemedText>
                        ))}
                      </View>
                    ) : null}
                    <Pressable
                      onPress={stopLiveShare}
                      style={({ pressed }) => [
                        styles.smallDeleteAction,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText type="smallBold">
                        Stop Live Share
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}
            <Pressable
              onPress={() => {
                setShareVisible(false);
                stopLiveShare();
              }}
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
        onRequestClose={() => setAccountModalVisible(false)}
        transparent
        visible={accountModalVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.shareMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {authUser ? "Cloud Sync Account" : accountMode === "login" ? "Sign In" : "Create Account"}
            </ThemedText>

            {authUser ? (
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Signed in as: {authUser.username}</ThemedText>
                {syncStatus ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {syncStatus}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={() => void handleCloudSync("push")}
                  style={({ pressed }) => [
                    styles.createMenuButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Push Local Regions to Cloud</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => void handleCloudSync("pull")}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Pull Cloud Regions to Local</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => void handleLogout()}
                  style={({ pressed }) => [
                    styles.smallDeleteAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Sign Out</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.shareModeOptions}>
                  <Pressable
                    onPress={() => {
                      setAccountMode("login");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    style={[
                      styles.shareModeOption,
                      accountMode === "login" && styles.selectedDropdown,
                    ]}
                  >
                    <ThemedText type="smallBold">Sign In</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAccountMode("register");
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    style={[
                      styles.shareModeOption,
                      accountMode === "register" && styles.selectedDropdown,
                    ]}
                  >
                    <ThemedText type="smallBold">Register</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold">Username</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setAuthUsername}
                    placeholder="e.g. trainer_red"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.input}
                    value={authUsername}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold">Password</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setAuthPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry
                    style={styles.input}
                    value={authPassword}
                  />
                </View>

                {authError ? (
                  <ThemedText type="small" style={{ color: "#ff6b6b" }}>
                    {authError}
                  </ThemedText>
                ) : null}

                {authSuccess ? (
                  <ThemedText type="small" style={{ color: "#51cf66" }}>
                    {authSuccess}
                  </ThemedText>
                ) : null}

                <Pressable
                  disabled={authLoading}
                  onPress={accountMode === "login" ? handleLogin : handleRegister}
                  style={({ pressed }) => [
                    styles.createMenuButton,
                    authLoading && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    {authLoading
                      ? "Loading..."
                      : accountMode === "login"
                        ? "Sign In"
                        : "Create Account"}
                  </ThemedText>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => setAccountModalVisible(false)}
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
        onRequestClose={() => setCommentEditorVisible(false)}
        transparent
        visible={commentEditorVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.shareMenu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {sharedComment ? "Edit Comment" : "Add Comment"}
            </ThemedText>
            <TextInput
              multiline
              onChangeText={setCommentDraft}
              placeholder="Share your thoughts on this region"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              style={[styles.input, styles.descriptionInput]}
              value={commentDraft}
            />
            <Pressable
              onPress={saveSharedComment}
              disabled={!commentDraft.trim()}
              style={({ pressed }) => [
                styles.createMenuButton,
                !commentDraft.trim() && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Save Comment</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setCommentEditorVisible(false)}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

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
                onPress={confirmRegionDelete}
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
        onRequestClose={() => {
          setMusicEditorVisible(false);
          setMusicExpanded(true);
          setContentMenuVisible(true);
        }}
        transparent
        visible={musicEditorVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.menu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              Add Music
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Music Name</ThemedText>
              <TextInput
                onChangeText={setMusicName}
                placeholder="e.g. Route Theme"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={musicName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Music Type</ThemedText>
              <View style={styles.musicTypeOptions}>
                {(["sheet", "file"] as MusicEntry["kind"][]).map(
                  (kind) => (
                    <Pressable
                      key={kind}
                      onPress={() => setMusicKind(kind)}
                      style={[
                        styles.typeChip,
                        (musicKind === kind ||
                          (kind === "sheet" && musicKind === "audio")) &&
                          styles.selectedDropdown,
                      ]}
                    >
                      <ThemedText type="small">
                        {kind === "sheet" ? "Audio/Sheet Music" : "File"}
                      </ThemedText>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Website Link or File</ThemedText>
              <TextInput
                autoCapitalize="none"
                onChangeText={setMusicUri}
                placeholder="https://example.com/theme.mp3"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={musicUri.startsWith("data:") ? "" : musicUri}
              />
              <Pressable
                onPress={chooseMusicFile}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">Upload File</ThemedText>
              </Pressable>
              {musicUri.startsWith("data:") ? (
                <ThemedText type="small" themeColor="textSecondary">
                  File selected and ready to save.
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={saveMusicEntry}
              disabled={!musicName.trim() || !musicUri.trim()}
              style={({ pressed }) => [
                styles.createMenuButton,
                (!musicName.trim() || !musicUri.trim()) && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Save Music</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setMusicEditorVisible(false);
                setMusicExpanded(true);
                setContentMenuVisible(true);
              }}
              style={styles.closeButton}
            >
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setGimmickCreateVisible(false);
          setGimmicksExpanded(true);
          setContentMenuVisible(true);
        }}
        transparent
        visible={gimmickCreateVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.menu}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              Create Gimmick
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Gimmick Name</ThemedText>
              <TextInput
                onChangeText={setNewGimmickName}
                placeholder="e.g. Terastallization"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={newGimmickName}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Category</ThemedText>
              <TextInput
                onChangeText={setNewGimmickCategory}
                placeholder="e.g. Transformation"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={styles.input}
                value={newGimmickCategory}
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Description</ThemedText>
              <TextInput
                multiline
                onChangeText={setNewGimmickDescription}
                placeholder="How does it work?"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                style={[styles.input, styles.descriptionInput]}
                value={newGimmickDescription}
              />
            </View>
            <Pressable
              onPress={saveNewGimmick}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Create and Add</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setGimmickCreateVisible(false);
                setGimmicksExpanded(true);
                setContentMenuVisible(true);
              }}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setImportExportVisible(false)}
        transparent
        visible={importExportVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.importExportModal}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {importExportMode === "import" ? "Import Regions" : "Export Regions"}
            </ThemedText>

            <TextInput
              multiline
              editable={importExportMode === "import"}
              onChangeText={
                importExportMode === "import" ? setImportText : undefined
              }
              placeholder={
                importExportMode === "import"
                  ? "Paste region JSON here"
                  : "Exported region data"
              }
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              style={styles.importExportTextArea}
              value={importExportMode === "import" ? importText : exportText}
            />

            {importError ? (
              <ThemedText type="small" style={styles.percentageError}>
                {importError}
              </ThemedText>
            ) : null}

            <View style={styles.importExportActions}>
              {importExportMode === "import" ? (
                <>
                  <Pressable
                    onPress={chooseImportFile}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Upload File</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={importRegions}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Import Data</ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => void copyExportData()}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Copy JSON</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={downloadExportData}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Download File</ThemedText>
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => setImportExportVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
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
                            onPress={() =>
                              confirmDeletePrompt({
                                title: "Remove route?",
                                message: `This will delete ${routeName} from this region.`,
                                onConfirm: () => removeRoute(routeIndex),
                              })
                            }
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
                onPress={() => toggleContentSection("music")}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Music</ThemedText>
                <ThemedText type="smallBold">
                  {musicExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {musicExpanded ? (
                <View style={styles.contentDropdownContent}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Add audio links, sheet music, or uploaded music files for this region.
                  </ThemedText>
                  {musicEntries.length > 0 ? (
                    <View style={styles.musicList}>
                      {musicEntries.map((entry, index) => (
                        <View key={`${entry.name}-${index}`} style={styles.musicCard}>
                          <View style={styles.musicDetails}>
                            <ThemedText type="smallBold">{entry.name}</ThemedText>
                            {Platform.OS === "web" && entry.kind === "audio"
                              ? createElement("audio", {
                                  controls: true,
                                  src: entry.uri,
                                  style: { width: "100%" },
                                })
                              : null}
                            {Platform.OS === "web" && getMusicProvider(entry.uri)
                              ? createElement("iframe", {
                                  allow: "autoplay; fullscreen",
                                  allowFullScreen: true,
                                  frameBorder: "0",
                                  loading: "lazy",
                                  title: entry.name,
                                  src: getMusicEmbedUri(entry.uri),
                                  style: { width: "100%", height: 300, border: 0 },
                                })
                              : null}
                            {Platform.OS === "web" && entry.kind === "sheet"
                              && !getMusicProvider(entry.uri)
                              ? entry.uri.toLowerCase().startsWith("data:image/")
                                ? createElement("img", {
                                    alt: entry.name,
                                    src: entry.uri,
                                    style: { maxWidth: "100%", maxHeight: 300, objectFit: "contain" },
                                  })
                                : createElement("iframe", {
                                    title: entry.name,
                                    src: entry.uri,
                                    style: { width: "100%", height: 260, border: 0 },
                                  })
                              : null}
                            <Pressable
                              onPress={() => void Linking.openURL(entry.uri)}
                              style={styles.musicOpenButton}
                            >
                              <ThemedText type="smallBold">
                                {entry.kind === "audio" ? "Open Audio" : "Open File"}
                              </ThemedText>
                            </Pressable>
                          </View>
                          <Pressable
                            onPress={() => removeMusicEntry(index)}
                            style={styles.smallDeleteAction}
                          >
                            <ThemedText type="smallBold">Remove</ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText type="small" style={styles.noGimmicksText}>
                      No music added yet.
                    </ThemedText>
                  )}
                  <Pressable
                    onPress={openMusicEditor}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Add Music</ThemedText>
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
                            onPress={() =>
                              confirmDeletePrompt({
                                title: "Remove gym?",
                                message: `This will remove ${gymName} and its saved team from this region.`,
                                onConfirm: () => removeGym(gymIndex),
                              })
                            }
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
                            onPress={() =>
                              confirmDeletePrompt({
                               title: "Remove Elite 4 member?",
                               message: `This will delete ${memberName} from this region.`,
                               onConfirm: () => removeEliteFour(memberIndex),
                              })
                            }
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
                            onPress={() =>
                              confirmDeletePrompt({
                                title: "Remove champion?",
                                message: `This will remove ${activeChampionName} from this region.`,
                                onConfirm: removeChampion,
                              })
                            }
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
                onPress={openGimmickSection}
                style={styles.contentDropdownHeader}
              >
                <ThemedText type="smallBold">Gimmicks</ThemedText>
                <ThemedText type="smallBold">
                  {gimmicksExpanded ? "−" : "+"}
                </ThemedText>
              </Pressable>
              {gimmicksExpanded ? (
                <View style={styles.contentDropdownContent}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Select saved gimmicks for this region, or create one here.
                  </ThemedText>
                  {availableGimmicks.length > 0 ? (
                    <View style={styles.gimmickOptions}>
                      {availableGimmicks.map((gimmick) => (
                        <Pressable
                          key={gimmick.name}
                          onPress={() => {
                            toggleGimmick(gimmick.name);
                          }}
                          style={[
                            styles.gimmickOption,
                            selectedGimmicks.includes(gimmick.name) &&
                              styles.selectedDropdown,
                          ]}
                        >
                          <ThemedText type="smallBold">{gimmick.name}</ThemedText>
                          {gimmick.category ? (
                            <ThemedText type="small">
                              {gimmick.category}
                            </ThemedText>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <ThemedText type="small" style={styles.noGimmicksText}>
                      No saved gimmicks yet.
                    </ThemedText>
                  )}
                  <Pressable
                    onPress={openGimmickCreate}
                    style={({ pressed }) => [
                      styles.createMenuButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Create Gimmick</ThemedText>
                  </Pressable>
                </View>
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
                      <View style={styles.filterHeader}>
                        <ThemedText type="smallBold">Filters</ThemedText>
                        <Pressable
                          onPress={resetPokemonFilters}
                          style={({ pressed }) => [
                            styles.clearFilterButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText type="small">Clear</ThemedText>
                        </Pressable>
                      </View>
                      <View style={styles.filterRow}>
                        <View style={styles.filterWrap}>
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
                        </View>
                        <View style={styles.filterWrap}>
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
                        </View>
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
                              source={{
                                uri: pokemon.isCustom
                                  ? pokemon.url || ""
                                  : getPokemonImageUrl(pokemon.url),
                              }}
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
    justifyContent: "flex-start",
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
  emptyImportExportActions: {
    width: "100%",
    maxWidth: 440,
    gap: 12,
    alignItems: "stretch",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  overviewStat: {
    minWidth: 120,
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    gap: 6,
  },
  emptyImportExportButton: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  topHeaderBar: {
    width: "100%",
    maxWidth: 640,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    marginBottom: -8,
  },
  accountBadgeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  accountBadgeButtonActive: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  resetSavedDataButton: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "rgba(196, 77, 77, 0.8)",
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(60, 135, 247, 0.88)",
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
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.18)",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  regionName: {
    fontSize: 28,
    lineHeight: 36,
  },
  regionList: {
    gap: 20,
    marginTop: 24,
  },
  regionCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(120, 140, 180, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
  regionMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    opacity: 0.8,
  },
  regionGimmickSummary: {
    marginTop: 8,
    opacity: 0.68,
  },
  regionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconActionButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  shareGlyph: {
    width: 24,
    height: 22,
    position: "relative",
  },
  shareNode: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shareNodeLeft: {
    left: 1,
    top: 7,
  },
  shareNodeTop: {
    right: 1,
    top: 1,
  },
  shareNodeBottom: {
    right: 1,
    bottom: 1,
  },
  shareLineTop: {
    position: "absolute",
    left: 6,
    top: 7,
    width: 15,
    height: 3,
    transform: [{ rotate: "-29deg" }],
    borderRadius: 2,
  },
  shareLineBottom: {
    position: "absolute",
    left: 6,
    bottom: 7,
    width: 15,
    height: 3,
    transform: [{ rotate: "29deg" }],
    borderRadius: 2,
  },
  footerActions: {
    width: "100%",
    maxWidth: 640,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingTop: 4,
    paddingBottom: 8,
    zIndex: 2,
  },
  toolbarButton: {
    minWidth: 90,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.8)",
    alignItems: "center",
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
    zIndex: 20,
  },
  menu: {
    width: "100%",
    maxWidth: 640,
    gap: 16,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  shareMenu: {
    width: "100%",
    maxWidth: 520,
    gap: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  sharePermissionOptions: {
    gap: 8,
  },
  sharePermissionOption: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(120, 140, 180, 0.16)",
  },
  shareModeOptions: {
    flexDirection: "row",
    gap: 8,
  },
  shareModeOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(120, 140, 180, 0.16)",
  },
  liveActivityList: {
    gap: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(120, 140, 180, 0.12)",
  },
  liveGuestNotice: {
    gap: 10,
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  liveGuestActions: {
    gap: 8,
    alignItems: "flex-start",
  },
  importExportModal: {
    width: "100%",
    maxWidth: 640,
    gap: 16,
    padding: 24,
    borderRadius: 16,
  },
  importExportTextArea: {
    minHeight: 220,
    maxHeight: 360,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
    textAlignVertical: "top",
  },
  importExportActions: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
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
  gimmickOptions: {
    gap: 8,
  },
  gimmickOption: {
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(120, 140, 180, 0.12)",
  },
  noGimmicksText: {
    opacity: 0.7,
  },
  musicList: {
    gap: 8,
  },
  musicCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(120, 140, 180, 0.12)",
  },
  musicDetails: {
    flex: 1,
    gap: 8,
  },
  musicOpenButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "rgba(60, 135, 247, 0.7)",
  },
  musicTypeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(120, 140, 180, 0.18)",
  },
  secondaryAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "rgba(120, 140, 180, 0.25)",
  },
  smallDeleteAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(220, 70, 70, 0.7)",
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
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  clearFilterButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  filterRow: {
    gap: 8,
    marginBottom: 8,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterOption: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
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
  descriptionInput: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: "top",
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
