import { readRecovery, saveRecovery, recoverRegion, type RecoveryEntry } from "@/utils/region-recovery";
import { copyText } from "@/utils/clipboard";
import { useResponsiveActions } from "@/hooks/use-responsive-actions";
import { Image } from "expo-image";
import { readLocalData, saveLocalData } from "@/utils/local-data";
import { SymbolView } from "expo-symbols";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { RegionChecklist, regionChecklist } from "@/components/region-checklist";
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
  sharedLinkKey?: string;
  temporary?: boolean;
  recoveryId?: string;
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
  time?: string;
  weather?: string;
  progression?: string;
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
    <View style={baseStyles.shareGlyph} accessible={false}>
      <View style={[baseStyles.shareLineTop, { backgroundColor: color }]} />
      <View style={[baseStyles.shareLineBottom, { backgroundColor: color }]} />
      <View style={[baseStyles.shareNode, baseStyles.shareNodeLeft, { backgroundColor: color }]} />
      <View style={[baseStyles.shareNode, baseStyles.shareNodeTop, { backgroundColor: color }]} />
      <View style={[baseStyles.shareNode, baseStyles.shareNodeBottom, { backgroundColor: color }]} />
    </View>
  );
}

export default function MyRegionsScreen() {
  const styles = useResponsiveActions(baseStyles, ["regionActions", "footerActions", "emptyImportExportActions", "shareModeOptions", "sharePermissionOptions", "importExportActions", "gymActions", "routeActionRow", "actionRow", "musicTypeOptions", "musicCard"], ["savedRegionName", "actionButton", "gymActionButton", "routeOptionButton", "secondaryAction", "musicDetails"]);
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
  const [creationTemplate, setCreationTemplate] = useState<number | "basic" | null>(null);
  const [encounterFilter, setEncounterFilter] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [unfinishedOnly, setUnfinishedOnly] = useState(false);
  const [routeCount, setRouteCount] = useState("");
  const [customRouteCount, setCustomRouteCount] = useState("1");
  const [customRoutesVisible, setCustomRoutesVisible] = useState(false);
  const [routeLimitDraft, setRouteLimitDraft] = useState("");
  const [routeCountError, setRouteCountError] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [recoveryEntries, setRecoveryEntries] = useState<RecoveryEntry<Region>[]>([]);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only saved data after the server-compatible initial render.
    try { setRecoveryEntries(readRecovery<Region>()); }
    catch (error) { setRecoveryMessage(error instanceof Error ? error.message : "Could not read recovery data."); }
  }, []);
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
  const [contentReveal] = useState(() => new Animated.Value(1));
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
  const [copyStatus, setCopyStatus] = useState("");
  const [manualShareLink, setManualShareLink] = useState("");
  const [commentResponseLink, setCommentResponseLink] = useState("");
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
  const theme = useTheme();
  const router = useRouter();
  const openedSharedLink = useRef<string | null>(null);

  const regionsRef = useRef(regions);
  const liveHostRef = useRef<{ index: number; permission: RegionSharePermission } | null>(null);
  useEffect(() => {
    regionsRef.current = regions;
    const host = liveHostRef.current;
    if (host && regions[host.index]) {
      liveSessionRef.current?.send({ type: "region", region: regions[host.index], permission: host.permission });
    }
  }, [regions]);

  function canEditRegion(region: Region | null | undefined) {
    return Boolean(region && (!region.sharePermission || region.sharePermission === "edit"));
  }

  function canEditContent() {
    return contentRegionIndex !== null && canEditRegion(regions[contentRegionIndex]);
  }

  function stopLiveShare() {
    setLiveGuestPermission(null);
    liveHostRef.current = null;
    liveSessionRef.current?.close();
    liveSessionRef.current = null;
    setLiveShareStatus("idle");
    setLiveShareLink("");
    setLiveActivity([]);
  }

  function startLiveShare() {
    if (shareRegionIndex === null || !canEditRegion(regions[shareRegionIndex]) || !isLiveShareSupported()) return;
    stopLiveShare();
    const regionIndex = shareRegionIndex;
    const roomCode = generateRoomCode();
    liveHostRef.current = { index: regionIndex, permission: sharePermission };
    setLiveShareLink(buildLiveShareLink(roomCode, sharePermission));
    setLiveActivity([]);
    setLiveShareStatus("connecting");

    const session = new LiveShareSession(roomCode, "host");
    session.onStatus = (status) => {
      setLiveShareStatus(status);
      if (status === "connected") {
        session.send({ type: "region", region: regionsRef.current[regionIndex], permission: sharePermission });
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
      if (message.type === "comment" && sharePermission === "comment" && typeof message.text === "string") {
        setLiveActivity((prev) => [...prev, `Comment: ${message.text}`]);
      } else if (message.type === "edit" && sharePermission === "edit") {
        if (!message.region || typeof message.region !== "object" || Array.isArray(message.region)) return;
        const [edited] = normalizeImportedRegions([message.region]);
        setRegions((current) => {
          if (!current[regionIndex]) return current;
          const next = [...current];
          next[regionIndex] = {
            ...current[regionIndex],
            ...edited,
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
    if (Platform.OS === "web") {
      const copied = await copyText(liveShareLink);
      setCopyStatus(copied ? "Live share link copied." : "Copy failed. Select and copy the link below.");
      return;
    }
    try {
      await Share.share({ message: liveShareLink, title: "Live Share Link" });
    } catch {
      setCopyStatus("Sharing failed. Select and copy the link below.");
    }
  }

  function sendGuestComment() {
    const text = guestCommentDraft.trim();
    if (!text || liveGuestPermission !== "comment" || !liveSessionRef.current) return;
    const sent = liveSessionRef.current.send({ type: "comment", text });
    if (sent) {
      setGuestCommentDraft("");
      setGuestCommentSent(true);
      setTimeout(() => setGuestCommentSent(false), 3000);
    }
  }

  function sendGuestEdits(region: Region) {
    if (liveGuestPermission !== "edit" || !canEditRegion(region) || !liveSessionRef.current) return;
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
    if (!encodedRegion) {
      openedSharedLink.current = null;
      return;
    }
    if (!hasLoadedRegions) return;
    const linkKey = `${params.permission ?? "view"}:${encodedRegion}`;
    if (openedSharedLink.current === linkKey) return;
    openedSharedLink.current = linkKey;
    const existingIndex = regions.findIndex(
      (region) => region.sharedLinkKey === linkKey,
    );
    if (existingIndex >= 0) {
      const existing = regions[existingIndex];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the selected preview once per incoming share link; openedSharedLink guards repeats.
      setContentRegionIndex(existingIndex);
      setMapPositions(existing.mapPositions);
      mapPositionsRef.current = existing.mapPositions;
      setSelectedGimmicks(existing.gimmicks);
      setMusicEntries(existing.music);
      setContentMenuVisible(true);
      return;
    }

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
        sharedLinkKey: linkKey,
        temporary: true,
      } satisfies Region;
      setRegions((currentRegions) => [...currentRegions, importedRegion]);
    } catch {
      setImportError("This shared region link is invalid or incomplete.");
    }
  }, [hasLoadedRegions, params.permission, params.sharedRegion, regions]);

  useEffect(() => {
    const encodedRegion = Array.isArray(params.sharedRegion)
      ? params.sharedRegion[0]
      : params.sharedRegion;
    if (!encodedRegion) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize comment controls when the external share URL changes.
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
      if (!message.region || typeof message.region !== "object" || Array.isArray(message.region)) return;
      const grantedPermission = message.permission === "edit" || message.permission === "comment" ? message.permission : "view";
      setLiveGuestPermission(grantedPermission);
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
        sharePermission: grantedPermission,
        sharedComments: [],
        liveRoomCode: roomCode,
        temporary: true,
      } satisfies Region;
      setRegions((current) => {
        const existingIndex = current.findIndex(
          (region) => region.liveRoomCode === roomCode,
        );
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = {
            ...importedRegion,
            temporary: current[existingIndex].temporary,
          };
          return next;
        }
        return [...current, importedRegion];
      });
    };
    liveSessionRef.current = session;
    session.connect();
    return () => {
      session.close();
      if (liveSessionRef.current === session) liveSessionRef.current = null;
      setLiveGuestPermission(null);
      setLiveShareStatus("idle");
    };
  }, [hasLoadedRegions, params.live, params.permission]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    LEGACY_STORAGE_KEYS.forEach((key) => {
      if (window.localStorage.getItem(key)) {
        window.localStorage.removeItem(key);
      }
    });

    const storedRegions = readLocalData(REGIONS_STORAGE_KEY);
    if (storedRegions) {
      try {
        const savedRegions = JSON.parse(storedRegions) as Partial<Region>[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate browser-only saved data after the server-compatible initial render.
        setRegions(
          savedRegions.map((region) => ({
            recoveryId: region.recoveryId,
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
            sharedLinkKey: region.sharedLinkKey,
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
    const stored = readLocalData(GIMMICKS_STORAGE_KEY);
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
    if (!canEditContent()) return;
    if (selectedGimmicks.includes(name) && !saveRecoverySnapshot("Before gimmick removal")) return;
    const nextSelection = selectedGimmicks.includes(name)
      ? selectedGimmicks.filter((gimmickName) => gimmickName !== name)
      : [...selectedGimmicks, name];
    setSelectedGimmicks(nextSelection);
    saveRegionGimmicks(nextSelection);
  }

  function openGimmickCreate() {
    if (!canEditContent()) return;
    setNewGimmickName("");
    setNewGimmickCategory("");
    setNewGimmickDescription("");
    setContentMenuVisible(false);
    setGimmickCreateVisible(true);
  }

  function saveNewGimmick() {
    if (!canEditContent()) return;
    const name = newGimmickName.trim();
    if (!name || typeof window === "undefined") return;
    const gimmick = {
      name,
      category: newGimmickCategory.trim(),
      description: newGimmickDescription.trim(),
    };
    const next = [...availableGimmicks.filter((item) => item.name !== name), gimmick];
    saveLocalData(GIMMICKS_STORAGE_KEY, JSON.stringify(next));
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
    if (!canEditContent()) return;
    if (contentRegionIndex === null) return;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex && canEditRegion(region)
          ? { ...region, gimmicks: nextGimmicks }
          : region,
      ),
    );
  }

  function saveMusic(nextMusic: MusicEntry[]) {
    if (!canEditContent()) return;
    if (contentRegionIndex === null) return;
    setMusicEntries(nextMusic);
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex && canEditRegion(region) ? { ...region, music: nextMusic } : region,
      ),
    );
  }

  function openMusicEditor() {
    if (!canEditContent()) return;
    setMusicName("");
    setMusicUri("");
    setMusicKind("sheet");
    setContentMenuVisible(false);
    setMusicEditorVisible(true);
  }

  function chooseMusicFile() {
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
    if (!saveRecoverySnapshot("Before music deletion")) return;
    saveMusic(musicEntries.filter((_, entryIndex) => entryIndex !== index));
  }

  useEffect(() => {
    if (typeof window !== "undefined" && hasLoadedRegions) {
      saveLocalData(
        REGIONS_STORAGE_KEY,
        JSON.stringify(regions.filter((region) => !region.temporary)),
      );
    }
  }, [hasLoadedRegions, regions]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the initial asynchronous catalog load and expose its loading state.
    void loadPokemonOptions();
  }, []);

  function openCreateMenu() {
    setCreationTemplate(null);
    setRegionName("");
    setRivalName("");
    setRegionType("");
    setRouteCount("");
    setRouteCountError("");
    setEditingRegionIndex(null);
    setMenuVisible(true);
  }

  function openEditMenu(index: number) {
    if (!canEditRegion(regions[index])) return;
    const region = regions[index];
    setRegionName(region.name);
    setRivalName(region.rivalName);
    setRegionType(region.type);
    setRouteCount(region.routes);
    setRouteCountError("");
    setEditingRegionIndex(index);
    setMenuVisible(true);
  }

  function duplicateRegion(index: number) {
    setRegions((currentRegions) => {
      const original = currentRegions[index];
      if (!original || original.sharePermission || original.liveRoomCode) {
        return currentRegions;
      }

      const baseName = `${original.name} (Copy)`;
      let copyName = baseName;
      let suffix = 2;
      const existingNames = new Set(
        currentRegions.map((region) => region.name.toLowerCase()),
      );
      while (existingNames.has(copyName.toLowerCase())) {
        copyName = `${original.name} (Copy ${suffix++})`;
      }

      // Region content is JSON data; clone nested teams and map positions so
      // changes to either region cannot alter the other region's content.
      const copy = JSON.parse(JSON.stringify(original)) as Region;
      copy.name = copyName;
      copy.sharedComments = [];
      return [...currentRegions, copy];
    });
  }

  function acceptSharedRegion(index: number) {
    setRegions((current) => current.map((region, regionIndex) =>
      regionIndex === index ? { ...region, temporary: false } : region,
    ));
  }

  function dismissSharedRegion(index: number) {
    stopLiveShare();
    setRegions((current) => current.filter((_, regionIndex) => regionIndex !== index));
    setContentMenuVisible(false);
    setContentRegionIndex(null);
    setSharedPermission(null);
    setSharedComment("");
    if (regions[index]?.liveRoomCode) {
      stopLiveShare();
      setLiveGuestPermission(null);
    }
    router.replace("/my-regions");
  }

  function openContentMenu(index: number) {
    setContentRegionIndex(index);
    const positions = regions[index]?.mapPositions ?? {};
    setMapPositions(positions);
    mapPositionsRef.current = positions;
    setEncounterFilter("");
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

  function validateRouteCount(value: string, minimum: number) {
    const count = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(count) || count < Math.max(1, minimum) || count > 999) {
      setRouteCountError(`Enter a whole number from ${Math.max(1, minimum)} to 999. Existing routes are never removed by changing the limit.`);
      return false;
    }
    setRouteCountError("");
    return true;
  }

  function updateRouteLimit() {
    if (!canEditContent() || contentRegionIndex === null) return;
    if (!validateRouteCount(routeLimitDraft, regions[contentRegionIndex].routeNames.length)) return;
    setRegions(current => current.map((region, index) => index === contentRegionIndex && canEditRegion(region)
      ? { ...region, routes: String(Number(routeLimitDraft)) } : region));
  }

  function addRoute(amount?: number) {
    if (!canEditContent()) return;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;

        const routeNames = region.routeNames ?? [];
        const routeLimit = Number(region.routes);
        if (!Number.isSafeInteger(routeLimit) || routeLimit < 1 || routeLimit > 999 || routeNames.length >= routeLimit) return region;
        const target = amount === undefined ? routeLimit : Math.min(routeLimit, routeNames.length + amount);
        if (!Number.isSafeInteger(target) || target <= routeNames.length) return region;

        const nextNames = [...routeNames];
        for (let number = 1; nextNames.length < target; number += 1) {
          const name = `Route ${number}`;
          if (!nextNames.includes(name)) nextNames.push(name);
        }
        return { ...region, routeNames: nextNames };
      }),
    );
  }

  function organizeContent(kind: "route" | "gym", source: number, action: "duplicate" | "up" | "down") {
    if (!canEditContent() || contentRegionIndex === null) return;
    setRegions(current => current.map((region, index) => {
      if (index !== contentRegionIndex || !canEditRegion(region)) return region;
      const names = [...(kind === "route" ? region.routeNames : region.gyms)];
      if (!names[source]) return region;
      const details = [...region.gymDetails];
      const teams = [...region.gymPokemon];
      if (action === "duplicate") {
        if (names.length >= (kind === "route" ? Number(region.routes) : 8)) return region;
        let suffix = 2;
        let name = `${names[source]} (Copy)`;
        while (names.includes(name)) name = `${names[source]} (Copy ${suffix++})`;
        names.push(name);
        if (kind === "route") return { ...region, routeNames: names,
          routeDetails: { ...region.routeDetails, [name]: { ...region.routeDetails[names[source]] } },
          routePokemon: { ...region.routePokemon, [name]: (region.routePokemon[names[source]] ?? []).map(entry => ({ ...entry })) } };
        details.push({ ...region.gymDetails[source] });
        teams.push((region.gymPokemon[source] ?? []).map(entry => ({ ...entry, moves: [...entry.moves] })));
      } else {
        const target = source + (action === "up" ? -1 : 1);
        if (target < 0 || target >= names.length) return region;
        [names[source], names[target]] = [names[target], names[source]];
        if (kind === "gym") {
          [details[source], details[target]] = [details[target], details[source]];
          [teams[source], teams[target]] = [teams[target], teams[source]];
        }
      }
      return kind === "route" ? { ...region, routeNames: names } : { ...region, gyms: names, gymDetails: details, gymPokemon: teams };
    }));
  }

  function removeRoute(routeIndex: number) {
    if (!canEditContent()) return;
    if (!saveRecoverySnapshot("Before route deletion")) return;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;

        const routeName = region.routeNames[routeIndex];
        const routePokemon = { ...region.routePokemon };
        delete routePokemon[routeName];

        return {
          ...region,
          routeNames: region.routeNames
            .filter((_, currentIndex) => currentIndex !== routeIndex),
          routePokemon,
          routeDetails: Object.fromEntries(
            region.routeNames
              .filter((_, currentIndex) => currentIndex !== routeIndex)
              .map((name) => [
                name,
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
    if (!canEditContent()) return;
    if (contentRegionIndex === null || amount <= 0) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;

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
    if (!canEditContent()) return;
    const suggestedGymCount = getSuggestedGymCount(activeRouteLimit);
    addGyms(suggestedGymCount - activeGymNames.length);
  }

  function openCustomGymMenu() {
    if (!canEditContent()) return;
    setCustomGymCount("");
    setGymCountMenuVisible(true);
  }

  function addCustomGyms() {
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
    if (contentRegionIndex === null || teamKind === null) return;
    if (!saveRecoverySnapshot("Before team changes")) return;
    const savedTeam = teamPokemon
      .filter((pokemon) => pokemon.name)
      .slice(0, MAX_TEAM_POKEMON);

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;
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
    if (!canEditContent()) return;
    if (contentRegionIndex === null || editingGymIndex === null) return;

    const name = gymName.trim() || `Gym ${editingGymIndex + 1}`;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;
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
    if (!canEditContent()) return;
    if (!saveRecoverySnapshot("Before gym deletion")) return;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;

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
    if (!canEditContent()) return;
    if (contentRegionIndex === null) return;
    setEditingEliteKind("eliteFour");
    setEditingEliteIndex(null);
    setEliteCreationKind("eliteFour");
    setEliteCreationNames(["", "", "", ""]);
    setEliteMemberMenuVisible(true);
  }

  function addChampion() {
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
    if (contentRegionIndex === null || editingEliteKind === null) return;

    if (eliteCreationKind !== null) {
      const names = eliteCreationNames.map((name) => name.trim());
      if (names.some((name) => !name)) return;

      setRegions((currentRegions) =>
        currentRegions.map((region, index) => {
          if (index !== contentRegionIndex || !canEditRegion(region)) return region;

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
          index === contentRegionIndex && canEditRegion(region)
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
          index === contentRegionIndex && canEditRegion(region) ? { ...region, champion: name } : region,
        ),
      );
    }

    setEliteMemberMenuVisible(false);
  }

  function removeEliteFour(memberIndex: number) {
    if (!canEditContent()) return;
    if (!saveRecoverySnapshot("Before Elite member deletion")) return;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) => {
        if (index !== contentRegionIndex || !canEditRegion(region)) return region;

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
    if (!canEditContent()) return;
    if (!saveRecoverySnapshot("Before champion deletion")) return;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex && canEditRegion(region) ? { ...region, champion: null } : region,
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
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
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
    if (!canEditContent()) return;
    mapDragRef.current = null;
    if (contentRegionIndex === null) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex && canEditRegion(region)
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
    if (!name || !validateRouteCount(routeCount, typeof creationTemplate === "number" ? regions[creationTemplate]?.routeNames.length ?? 0 : 0)) return;

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
        ...((creationTemplate === "basic" ? {
          gyms: Array.from({length: 8}, (_, index) => `Gym ${index + 1}`),
          gymDetails: Array.from({length: 8}, () => ({leader: "", specialty: "", badge: "", levelCap: "", reward: "", puzzle: ""})),
          gymPokemon: Array.from({length: 8}, () => []),
        } : typeof creationTemplate === "number" && regions[creationTemplate] ? (() => {
          const template = JSON.parse(JSON.stringify(regions[creationTemplate])) as Region;
          return {routeNames: template.routeNames, routePokemon: template.routePokemon, routeDetails: template.routeDetails,
            gyms: template.gyms, gymDetails: template.gymDetails, gymPokemon: template.gymPokemon,
            eliteFour: template.eliteFour, eliteFourPokemon: template.eliteFourPokemon, champion: template.champion,
            championPokemon: template.championPokemon, mapPositions: template.mapPositions, gimmicks: template.gimmicks, music: template.music};
        })() : {}) as Partial<Region>),
      },
    ]);
    setMenuVisible(false);
  }

  function saveRegion() {
    if (editingRegionIndex === null || !canEditRegion(regions[editingRegionIndex])) return;
    const name = regionName.trim();
    if (!name || !validateRouteCount(routeCount, regions[editingRegionIndex].routeNames.length)) return;

    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === editingRegionIndex && canEditRegion(region)
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
    if (!canEditContent()) return;
    const total = selectedRoutePokemon.reduce(
      (sum, entry) => sum + Number(entry.percentage || 0),
      0,
    );
    if (!Number.isFinite(total) || Math.abs(total - 100) > 0.001 || selectedRoutePokemon.some((entry) => !entry.name || !Number.isFinite(Number(entry.percentage)) || Number(entry.percentage) < 0 || Number(entry.percentage) > 100)) {
      setPercentageError(true);
      return;
    }

    if (contentRegionIndex === null) return;
    if (!saveRecoverySnapshot("Before route encounter changes")) return;
    setRegions((currentRegions) =>
      currentRegions.map((region, index) =>
        index === contentRegionIndex && canEditRegion(region)
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

  function archiveRegion(index: number, kind: "region" | "snapshot", description?: string) {
    const region = regions[index];
    if (!region) return null;
    try {
      const previous = typeof window === "undefined" ? recoveryEntries : readRecovery<Region>();
      const entry: RecoveryEntry<Region> = {
        id: generateRoomCode(), name: description ? `${region.name} — ${description}` : region.name,
        region: JSON.parse(JSON.stringify(region)), index,
        deletedAt: new Date().toISOString(), kind,
      };
      const next = [entry, ...previous];
      if (typeof window !== "undefined" && !saveRecovery(next)) {
        setRecoveryMessage("Deletion cancelled: the recovery copy could not be saved. Free browser storage and retry.");
        return null;
      }
      setRecoveryEntries(next);
      setRecoveryMessage("");
      return entry.id;
    } catch {
      setRecoveryMessage("Deletion cancelled: recovery storage could not be read. Export a backup first.");
      return null;
    }
  }

  function saveRecoverySnapshot(description: string) {
    return contentRegionIndex !== null && archiveRegion(contentRegionIndex, "snapshot", description) !== null;
  }

  function restoreRecoveryEntry(id: string) {
    const entry = recoveryEntries.find((item) => item.id === id);
    if (!entry) return;
    const next = recoverRegion(regions, entry);
    if (next === regions && !regions.some((region) => region.recoveryId === id)) {
      setRecoveryMessage("This shared region is already saved. Its recovery copy has been kept.");
      return;
    }
    // Save the restored region first. Keep recovery if either write fails.
    if (typeof window !== "undefined" && !saveLocalData(REGIONS_STORAGE_KEY, JSON.stringify(next.filter((region) => !region.temporary)))) {
      setRecoveryMessage("Restore could not be saved. Your recovery copy is still available.");
      return;
    }
    setRegions(next);
    const remaining = recoveryEntries.filter((item) => item.id !== id);
    if (typeof window !== "undefined" && !saveRecovery(remaining)) {
      setRecoveryMessage("Region restored. Recovery cleanup could not be saved; retrying Restore will not duplicate it.");
      return;
    }
    setRecoveryEntries(remaining);
    setLastDeletedId(null);
    setRecoveryMessage(entry.kind === "snapshot" ? "Recovered a separate region copy; your later edits are unchanged." : "Region restored.");
  }

  function removeSavedRegion(index: number) {
    const region = regions[index];
    if (!region) return;
    const recoveryId = archiveRegion(index, "region");
    if (!recoveryId) return;
    stopLiveShare();
    setLiveGuestPermission(null);
    setLastDeletedId(recoveryId);
    setRegions((current) => current.filter((_, regionIndex) => regionIndex !== index));
    setMenuVisible(false);
    setContentMenuVisible(false);
    setContentRegionIndex(null);
    setEditingRegionIndex(null);
    // Clear the link so deleting a saved copy does not immediately import it again.
    router.replace("/my-regions");
    setSharedPermission(null);
  }

  function undoRegionDeletion() {
    if (lastDeletedId) restoreRecoveryEntry(lastDeletedId);
  }

  function deleteRegion() {
    if (editingRegionIndex !== null) removeSavedRegion(editingRegionIndex);
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
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          regions: regions.filter((region) => !region.temporary),
        },
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
      stopLiveShare();
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
    const copied = await copyText(exportText);
    setImportError(copied ? "Export copied." : "Copy failed. Select the export text above or download the file.");
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

    setManualShareLink(link);
    if (Platform.OS === "web") {
      const copied = await copyText(link);
      setCopyStatus(copied ? "Share link copied." : "Copy failed. Select and copy the link below.");
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
    const sharedRegion = regions.find((region) => region.sharedLinkKey === openedSharedLink.current);
    if (!sharedComment || !sharedRegion) return;
    const responseLink = createCommentResponseLink(sharedRegion, sharedComment);
    if (!responseLink) return;

    setCommentResponseLink(responseLink);
    if (Platform.OS === "web") {
      const copied = await copyText(responseLink);
      setCommentSentMessage(copied
        ? "Comment response link copied. Send it to the region owner."
        : "Copy failed. Select and copy the comment response link below.");
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
  const contentReadOnly = !canEditRegion(activeContentRegion);
  const activeRouteNames = activeContentRegion?.routeNames ?? [];
  const activeGymNames = activeContentRegion?.gyms ?? [];
  const activeRouteLimit = Number(activeContentRegion?.routes);
  const canAddRoute =
    activeRouteLimit > 0 && activeRouteNames.length < activeRouteLimit;
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
      <ScrollView
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator
        style={styles.screenScroll}
      >
      <ThemedText type="title">My Regions</ThemedText>
      {recoveryMessage ? <ThemedText accessibilityLiveRegion="polite" type="small">{recoveryMessage}</ThemedText> : null}
      {lastDeletedId ? (
        <Pressable accessibilityRole="button" onPress={undoRegionDeletion} style={styles.contentButton}>
          <ThemedText type="smallBold">Undo deletion</ThemedText>
        </Pressable>
      ) : null}
      {recoveryEntries.length ? (
        <ThemedView type="backgroundElement" style={styles.liveGuestNotice}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: recoveryExpanded }} onPress={() => setRecoveryExpanded(!recoveryExpanded)} style={styles.contentButton}>
            <ThemedText type="smallBold">Recently Deleted & Recovery ({recoveryEntries.length})</ThemedText>
          </Pressable>
          {recoveryExpanded ? <>
            <ThemedText type="small">Recovery copies stay in this browser across reloads and are included in full backups. Content deletions restore a separate region copy so later edits are kept.</ThemedText>
            {recoveryEntries.map((entry) => <View key={entry.id} style={styles.actionRow}>
              <ThemedText style={{ flexShrink: 1 }} type="small">{entry.name} · {new Date(entry.deletedAt).toLocaleDateString()}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Restore ${entry.name}`} onPress={() => restoreRecoveryEntry(entry.id)} style={styles.contentButton}>
                <ThemedText type="smallBold">Restore</ThemedText>
              </Pressable>
            </View>)}
          </> : null}
        </ThemedView>
      ) : null}
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
          {liveShareStatus !== "connected" ? (
            <Pressable accessibilityRole="button" onPress={() => liveSessionRef.current?.connect()} style={styles.contentButton}>
              <ThemedText type="smallBold">Reconnect</ThemedText>
            </Pressable>
          ) : null}
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
      {commentResponseLink ? (
        <TextInput accessibilityLabel="Comment response link" editable={false} multiline selectTextOnFocus value={commentResponseLink} style={[styles.input, { maxHeight: 100 }]} />
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
              : "Shared regions open as temporary previews. Choose ✓ Add to keep a copy on this device, or ✕ Dismiss to close the preview."}
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
            <TextInput accessibilityLabel="Search regions and contents" placeholder="Search regions, routes, gyms, or Pokémon" value={regionSearch} onChangeText={setRegionSearch} style={styles.input} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: unfinishedOnly }} onPress={() => setUnfinishedOnly(value => !value)} style={styles.closeButton}>
              <ThemedText>{unfinishedOnly ? "✓ " : ""}Show unfinished regions only</ThemedText>
            </Pressable>
            <View style={styles.regionList}>
              {regions.map((region, index) => ({region,index})).filter(({region}) => {
                const searchable = [region.name, region.rivalName, region.type, ...region.routeNames, ...region.gyms,
                  ...Object.values(region.routePokemon).flat().map(pokemon => pokemon.name),
                  ...region.gymPokemon.flat().map(pokemon => pokemon.name), ...region.eliteFour,
                  ...region.eliteFourPokemon.flat().map(pokemon => pokemon.name), region.champion ?? "",
                  ...region.championPokemon.map(pokemon => pokemon.name)].join(" ").toLowerCase();
                return searchable.includes(regionSearch.trim().toLowerCase()) && (!unfinishedOnly || regionChecklist(region).some(item => !item.done));
              }).map(({region, index}) => (
                <View key={`${region.name}-${region.rivalName}-${index}`} style={styles.regionCard}>
                  <RegionChecklist region={region} onOpen={section => {
                    openContentMenu(index);
                    setRoutesExpanded(section === "routes"); setGymsExpanded(section === "gyms");
                    setEliteFourExpanded(section === "eliteFour"); setMapExpanded(section === "map");
                  }} />
                  {region.temporary ? (
                    <View style={styles.regionActions}>
                      {region.sharePermission && !region.temporary ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved copy of ${region.name}`}
                          onPress={() => confirmDeletePrompt({ title: "Remove saved copy?", message: "This removes the copy on this device. You can restore it from Recently Deleted & Recovery.", onConfirm: () => removeSavedRegion(index) })}
                          style={styles.contentButton}>
                          <ThemedText type="smallBold">Remove copy</ThemedText>
                        </Pressable>
                      ) : null}
                      <ThemedText type="small">Temporary shared preview</ThemedText>
                      <Pressable
                        accessibilityLabel={`Add ${region.name} permanently`}
                        accessibilityRole="button"
                        onPress={() => acceptSharedRegion(index)}
                        style={styles.contentButton}
                      >
                        <ThemedText type="smallBold">✓ Add</ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Dismiss ${region.name}`}
                        accessibilityRole="button"
                        onPress={() => dismissSharedRegion(index)}
                        style={styles.contentButton}
                      >
                        <ThemedText type="smallBold">✕ Dismiss</ThemedText>
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={styles.regionRow}>
                    <ThemedText
                      type="subtitle"
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      numberOfLines={3}
                      style={styles.savedRegionName}
                    >
                      {region.name}
                    </ThemedText>
                    <View style={styles.regionActions}>
                      {region.sharePermission && !region.temporary ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved copy of ${region.name}`}
                          onPress={() => confirmDeletePrompt({ title: "Remove saved copy?", message: "This removes the copy on this device. You can restore it from Recently Deleted & Recovery.", onConfirm: () => removeSavedRegion(index) })}
                          style={styles.contentButton}>
                          <ThemedText type="smallBold">Remove copy</ThemedText>
                        </Pressable>
                      ) : null}
                      {!region.sharePermission && !region.liveRoomCode ? (
                        <Pressable
                          accessibilityLabel={`Duplicate ${region.name}`}
                          accessibilityRole="button"
                          onPress={() => duplicateRegion(index)}
                          style={({ pressed }) => [
                            styles.contentButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ThemedText type="smallBold">Duplicate</ThemedText>
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={!canEditRegion(region)}
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
                            setCopyStatus("");
                            setManualShareLink("");
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
        </View>
      ) : null}

      </ScrollView>

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
                onPress={() => { setCopyStatus(""); setShareMode("link"); }}
                style={[
                  styles.shareModeOption,
                  shareMode === "link" && styles.selectedDropdown,
                ]}
              >
                <ThemedText type="smallBold">Share Link</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => { setCopyStatus(""); setShareMode("live"); }}
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
                  selected permission. Anyone with the link receives the data and can make their own copy; snapshot permissions are not access security.
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
                    {liveShareStatus !== "connected" ? (
                      <Pressable accessibilityRole="button" onPress={() => liveSessionRef.current?.connect()} style={styles.contentButton}>
                        <ThemedText type="smallBold">Reconnect</ThemedText>
                      </Pressable>
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
            {copyStatus ? <ThemedText accessibilityLiveRegion="polite" type="small">{copyStatus}</ThemedText> : null}
            {(shareMode === "live" ? liveShareLink : manualShareLink) ? (
              <TextInput accessibilityLabel="Share link" editable={false} multiline selectTextOnFocus
                value={shareMode === "live" ? liveShareLink : manualShareLink}
                style={[styles.input, { maxHeight: 100 }]} />
            ) : null}
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
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator
            style={styles.modalScroll}
          >
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

            {editingRegionIndex === null ? <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Start from a template</ThemedText>
              <View style={styles.gymActions}>
                <Pressable style={styles.closeButton} onPress={() => setCreationTemplate(null)}><ThemedText>{creationTemplate === null ? "✓ " : ""}Blank</ThemedText></Pressable>
                <Pressable style={styles.closeButton} onPress={() => {setCreationTemplate("basic"); setRouteCount("20");}}><ThemedText>{creationTemplate === "basic" ? "✓ " : ""}Eight gyms</ThemedText></Pressable>
                {regions.map((region, index) => canEditRegion(region) && !region.temporary ? <Pressable key={index} style={styles.closeButton}
                  onPress={() => {setCreationTemplate(index); setRouteCount(region.routes); setRegionType(region.type);}}>
                  <ThemedText>{creationTemplate === index ? "✓ " : ""}Use {region.name}</ThemedText></Pressable> : null)}
              </View>
            </View> : null}
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold">Number of Routes</ThemedText>
              <TextInput accessibilityLabel="Number of Routes" keyboardType="number-pad"
                placeholder="e.g. 20" value={routeCount} onChangeText={setRouteCount} style={styles.input} />
              <ThemedText type="small">Choose 1–999 routes. You can change this limit later.</ThemedText>
              {routeCountError ? <ThemedText type="small">{routeCountError}</ThemedText> : null}
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
          </ScrollView>
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
                    <Pressable disabled={contentReadOnly}
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
              <Pressable disabled={contentReadOnly}
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
              disabled={contentReadOnly || (!musicName.trim() || !musicUri.trim())}
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
            <Pressable disabled={contentReadOnly}
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
                  <TextInput accessibilityLabel="Filter encounters" placeholder="Filter by route, Pokémon, terrain, time, weather, or progression" value={encounterFilter} onChangeText={setEncounterFilter} style={styles.input} />
                  <ScrollView
                    style={styles.contentRouteList}
                    contentContainerStyle={styles.contentRouteContent}
                    showsVerticalScrollIndicator
                  >
                    {activeRouteNames.map((routeName, routeIndex) => ({routeName, routeIndex})).filter(({routeName}) => {
                      const details = activeContentRegion?.routeDetails[routeName];
                      return [routeName, details?.terrain, details?.time, details?.weather, details?.progression,
                        ...(activeContentRegion?.routePokemon[routeName] ?? []).map(entry => entry.name)].join(" ").toLowerCase().includes(encounterFilter.trim().toLowerCase());
                    }).map(({routeName, routeIndex}) => (
                      <Animated.View
                        key={`${routeName}-${routeIndex}`}
                        style={getWaterfallStyle(
                          routeIndex,
                          activeRouteNames.length + 1,
                        )}
                      >
                        <View style={styles.routeActionRow}>
                          {!contentReadOnly ? <>
                            {(["up", "down", "duplicate"] as const).map(action => <Pressable key={action}
                              accessibilityLabel={`${action} ${routeName}`} style={styles.closeButton}
                              disabled={(action === "up" && routeIndex === 0) || (action === "down" && routeIndex === activeRouteNames.length - 1) || (action === "duplicate" && !canAddRoute)}
                              onPress={() => organizeContent("route", routeIndex, action)}>
                              <ThemedText>{action === "up" ? "↑" : action === "down" ? "↓" : "Duplicate"}</ThemedText>
                            </Pressable>)}
                          </> : null}
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
                          <Pressable disabled={contentReadOnly}
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
                  <ThemedText type="small">{activeRouteNames.length} of {activeRouteLimit || 0} routes added</ThemedText>
                  {!contentReadOnly ? <>
                    <Pressable style={styles.closeButton} onPress={() => {
                      setRouteLimitDraft(String(activeRouteLimit || 1)); setCustomRouteCount("1");
                      setRouteCountError(""); setCustomRoutesVisible(true);
                    }}><ThemedText type="smallBold">Change Route Limit</ThemedText></Pressable>
                    {canAddRoute ? <View style={styles.routeActionRow}>
                      <Pressable onPress={() => addRoute()} style={styles.createMenuButton}>
                        <ThemedText type="smallBold">Add All Routes</ThemedText>
                      </Pressable>
                      <Pressable style={styles.createMenuButton} onPress={() => {
                        setRouteLimitDraft(String(activeRouteLimit)); setCustomRouteCount("1");
                        setRouteCountError(""); setCustomRoutesVisible(true);
                      }}><ThemedText type="smallBold">Add Custom Routes</ThemedText></Pressable>
                    </View> : <ThemedText type="small">Route limit reached</ThemedText>}
                  </> : null}
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
                          <Pressable disabled={contentReadOnly}
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
                  <Pressable disabled={contentReadOnly}
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
                      disabled={contentReadOnly || (!canAddSuggestedGyms)}
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
                      disabled={contentReadOnly || (remainingGymSlots <= 0)}
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
                          {!contentReadOnly ? <>
                            {(["up", "down", "duplicate"] as const).map(action => <Pressable key={action}
                              accessibilityLabel={`${action} ${gymName}`} style={styles.closeButton}
                              disabled={(action === "up" && gymIndex === 0) || (action === "down" && gymIndex === activeGymNames.length - 1) || (action === "duplicate" && remainingGymSlots <= 0)}
                              onPress={() => organizeContent("gym", gymIndex, action)}>
                              <ThemedText>{action === "up" ? "↑" : action === "down" ? "↓" : "Duplicate"}</ThemedText>
                            </Pressable>)}
                          </> : null}
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
                          <Pressable disabled={contentReadOnly}
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
                        disabled={contentReadOnly || (!canAddEliteFour)}
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
                        disabled={contentReadOnly || (!canAddChampion)}
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
                          <Pressable disabled={contentReadOnly}
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
                          <Pressable disabled={contentReadOnly}
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
                        <Pressable disabled={contentReadOnly}
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
                  <Pressable disabled={contentReadOnly}
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
                  <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
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
                          onStartShouldSetResponder={() => !contentReadOnly}
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
                          onStartShouldSetResponder={() => !contentReadOnly}
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
                  </ScrollView>
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

      <Modal animationType="fade" transparent visible={customRoutesVisible} onRequestClose={() => setCustomRoutesVisible(false)}>
        <View style={styles.modalOverlay}><ThemedView type="backgroundElement" style={styles.gymCountMenu}>
          <ThemedText type="subtitle">Add Custom Routes</ThemedText>
          <ThemedText type="small">Route limit · {activeRouteNames.length} already added</ThemedText>
          <TextInput accessibilityLabel="Route limit" editable={!contentReadOnly} keyboardType="number-pad" value={routeLimitDraft} onChangeText={setRouteLimitDraft} style={styles.input} />
          <Pressable disabled={contentReadOnly} onPress={updateRouteLimit} style={styles.closeButton}><ThemedText>Save Route Limit</ThemedText></Pressable>
          <ThemedText type="small">How many routes? {Math.max(0, activeRouteLimit - activeRouteNames.length)} slots available.</ThemedText>
          <TextInput accessibilityLabel="Routes to add" editable={!contentReadOnly} keyboardType="number-pad" value={customRouteCount} onChangeText={setCustomRouteCount} style={styles.input} />
          {routeCountError ? <ThemedText>{routeCountError}</ThemedText> : null}
          <Pressable disabled={contentReadOnly || !canAddRoute} style={styles.createMenuButton} onPress={() => {
            const amount = Number(customRouteCount);
            if (!/^\d+$/.test(customRouteCount) || !Number.isSafeInteger(amount) || amount < 1 || amount > activeRouteLimit - activeRouteNames.length) {
              setRouteCountError("Enter a whole number within the available route slots."); return;
            }
            addRoute(amount); setCustomRoutesVisible(false);
          }}><ThemedText>Add Routes</ThemedText></Pressable>
          <Pressable onPress={() => setCustomRoutesVisible(false)} style={styles.closeButton}><ThemedText>Close</ThemedText></Pressable>
        </ThemedView></View>
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
                editable={!contentReadOnly}
                placeholder="e.x. Boulder Gym"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                onChangeText={setGymName}
                style={styles.input}
                value={gymName}
              />
            </View>
            <DetailInput
                editable={!contentReadOnly}
              label="Leader"
              value={gymDetails.leader}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, leader: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Specialty"
              value={gymDetails.specialty}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, specialty: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Badge"
              value={gymDetails.badge}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, badge: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Level Cap"
              value={gymDetails.levelCap}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, levelCap: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Reward"
              value={gymDetails.reward}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, reward: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Puzzle"
              value={gymDetails.puzzle}
              onChangeText={(value) =>
                setGymDetails((current) => ({ ...current, puzzle: value }))
              }
            />
            <Pressable disabled={contentReadOnly}
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
            {!contentReadOnly && activeContentRegion ? <View style={styles.gymActions}>
              <ThemedText type="smallBold">Copy a team into this draft</ThemedText>
              {[...activeContentRegion.gyms.map((name, index) => ({name, team: activeContentRegion.gymPokemon[index]})),
                ...activeContentRegion.eliteFour.map((name, index) => ({name, team: activeContentRegion.eliteFourPokemon[index]})),
                {name: activeContentRegion.champion ?? "Champion", team: activeContentRegion.championPokemon}]
                .filter(source => source.team?.length).map((source, index) => <Pressable key={index} style={styles.closeButton}
                  onPress={() => confirmDeletePrompt({title: "Replace draft team?", message: "This replaces only the team draft. Save Team applies it to the region.", onConfirm: () => {setTeamPokemon(source.team.map(entry => ({...entry, moves: [...entry.moves]}))); setTeamPokemonMenuIndex(null);}})}>
                  <ThemedText>{source.name}</ThemedText></Pressable>)}
            </View> : null}
            <ScrollView
              style={styles.teamPokemonList}
              contentContainerStyle={styles.contentRouteContent}
              showsVerticalScrollIndicator
            >
              {teamPokemon.map((pokemon, pokemonIndex) => (
                <View key={pokemonIndex} style={styles.teamPokemonRow}>
                  {!contentReadOnly ? <View style={styles.routeActionRow}>{([-1, 1] as const).map(direction => <Pressable key={direction}
                    accessibilityLabel={`Move team member ${pokemonIndex + 1} ${direction < 0 ? "up" : "down"}`}
                    disabled={pokemonIndex + direction < 0 || pokemonIndex + direction >= teamPokemon.length}
                    style={styles.closeButton} onPress={() => {
                      setTeamPokemon(current => { const next = [...current]; const target = pokemonIndex + direction;
                        [next[pokemonIndex], next[target]] = [next[target], next[pokemonIndex]]; return next; });
                      setTeamPokemonMenuIndex(null);
                    }}><ThemedText>{direction < 0 ? "↑" : "↓"}</ThemedText></Pressable>)}</View> : null}
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
                  <Pressable disabled={contentReadOnly}
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
                editable={!contentReadOnly}
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
                          <Pressable disabled={contentReadOnly}
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
                editable={!contentReadOnly}
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
              disabled={contentReadOnly || (teamPokemon.length >= MAX_TEAM_POKEMON)}
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
              <Pressable disabled={contentReadOnly}
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
                editable={!contentReadOnly}
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
                editable={!contentReadOnly}
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
            <Pressable disabled={contentReadOnly}
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
                editable={!contentReadOnly}
              label="Terrain"
              value={routeDetails.terrain}
              onChangeText={(value) =>
                setRouteDetails((current) => ({ ...current, terrain: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
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
                editable={!contentReadOnly}
              label="Items"
              value={routeDetails.items}
              onChangeText={(value) =>
                setRouteDetails((current) => ({ ...current, items: value }))
              }
            />
            <DetailInput
                editable={!contentReadOnly}
              label="Trainers"
              value={routeDetails.trainers}
              onChangeText={(value) =>
                setRouteDetails((current) => ({
                  ...current,
                  trainers: value,
                }))
              }
            />
            <ThemedText type="smallBold">Encounter conditions for this route</ThemedText>
            {(["time", "weather", "progression"] as const).map(field => <DetailInput key={field} editable={!contentReadOnly}
              label={field === "time" ? "Time of day" : field === "weather" ? "Weather" : "Progression requirement"}
              value={routeDetails[field] ?? ""} onChangeText={value => setRouteDetails(current => ({...current, [field]: value}))} />)}
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
                editable={!contentReadOnly}
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
                editable={!contentReadOnly}
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
                          <Pressable disabled={contentReadOnly}
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
            <Pressable disabled={contentReadOnly}
              onPress={addPokemon}
              style={({ pressed }) => [
                styles.createMenuButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Add Pokemon</ThemedText>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable disabled={contentReadOnly}
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
  editable = true,
  label,
  value,
  onChangeText,
}: {
  editable?: boolean;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={baseStyles.fieldGroup}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        editable={editable}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="rgba(255, 255, 255, 0.6)"
        style={baseStyles.input}
        value={value}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenScroll: {
    width: "100%",
  },
  screenScrollContent: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 12,
  },
  modalScroll: {
    width: "100%",
    maxHeight: "92%",
  },
  modalScrollContent: {
    alignItems: "center",
    paddingVertical: 12,
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
    justifyContent: "center",
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
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    padding: 16,
    paddingTop: 60,
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
    gap: 16,
    marginTop: 16,
  },
  regionCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(120, 140, 180, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  savedRegionName: {
    width: "100%",
    flexShrink: 1,
    fontSize: 28,
    lineHeight: 36,
  },
  regionRow: {
    minHeight: 40,
    flexDirection: "column",
    alignItems: "stretch",
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
    flexWrap: "wrap",
    justifyContent: "flex-end",
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
    flexWrap: "wrap",
    marginTop: 20,
    paddingTop: 4,
    paddingBottom: 8,
    zIndex: 2,
  },
  toolbarButton: {
    minWidth: 84,
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
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  shareMenu: {
    width: "100%",
    maxWidth: 520,
    gap: 16,
    padding: 20,
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
    flexWrap: "wrap",
    gap: 8,
  },
  shareModeOption: {
    flexGrow: 1,
    flexBasis: "45%",
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
    padding: 16,
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
    fontSize: 32,
    lineHeight: 40,
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
    minWidth: 490,
    flex: 1,
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
