import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";

type RegionPlan = {
  routes: string;
  routeNames: string[];
  routePokemon: Record<string, { name: string; percentage: string }[]>;
  gyms: string[];
  gymDetails: { leader: string }[];
  gymPokemon: { name: string }[][];
  eliteFour: string[];
  eliteFourPokemon: { name: string }[][];
  champion: string | null;
  championPokemon: { name: string }[];
  mapPositions: Record<string, { x: number; y: number }>;
};

export function regionChecklist(region: RegionPlan) {
  const routeTarget = Number(region.routes);
  const hasTeam = (team: { name: string }[] | undefined) => team?.some((pokemon) => pokemon.name.trim()) ?? false;
  return [
    { label: "Planned routes added", done: routeTarget > 0 && region.routeNames.length >= routeTarget },
    { label: "Gyms and leaders named", done: region.gyms.length > 0 && region.gyms.every((_, i) => region.gymDetails[i]?.leader?.trim()) },
    { label: "Every gym has a team", done: region.gyms.length > 0 && region.gyms.every((_, i) => hasTeam(region.gymPokemon[i])) },
    { label: "Four Elite members named", done: region.eliteFour.length === 4 && region.eliteFour.every((name) => name.trim()) },
    { label: "Every Elite member has a team", done: region.eliteFour.length === 4 && region.eliteFour.every((_, i) => hasTeam(region.eliteFourPokemon[i])) },
    { label: "Champion named with a team", done: Boolean(region.champion?.trim()) && hasTeam(region.championPokemon) },
    { label: "Map positions placed", done: Object.keys(region.mapPositions).length > 0 },
  ];
}

export function RegionChecklist({ region, onOpen }: { region: RegionPlan; onOpen?: (section: "routes" | "gyms" | "eliteFour" | "map") => void }) {
  const [expanded, setExpanded] = useState(false);
  const items = regionChecklist(region);
  const complete = items.filter((item) => item.done).length;
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.toggle}>
        <ThemedText type="smallBold">{expanded ? "▾" : "▸"} Planning checklist · {complete}/{items.length}</ThemedText>
      </Pressable>
      {expanded ? <>
        <ThemedText type="small">Routes {region.routeNames.length}/{region.routes || 0} · Gyms {region.gyms.length}/8 · Elite {region.eliteFour.length}/4</ThemedText>
        {items.map((item, index) => <Pressable key={item.label} accessibilityRole="button" onPress={() => onOpen?.(index === 0 ? "routes" : index < 3 ? "gyms" : index < 6 ? "eliteFour" : "map")} style={styles.toggle}>
          <ThemedText type="small">{item.done ? "✓" : "○"} {item.label} →</ThemedText>
        </Pressable>)}
        {region.routeNames.filter(name => {
          const encounters = region.routePokemon[name] ?? [];
          return !encounters.length || encounters.some(entry => !entry.name || !Number.isFinite(Number(entry.percentage)) || Number(entry.percentage) < 0) || Math.abs(encounters.reduce((sum, entry) => sum + Number(entry.percentage), 0) - 100) > 0.001;
        }).map(name => <ThemedText key={name} type="small">Check {name}: encounters must total 100%.</ThemedText>)}
        {new Set(region.gyms.map(name => name.trim().toLowerCase())).size < region.gyms.length ? <ThemedText type="small">Check duplicate gym names.</ThemedText> : null}
      </> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 12 },
  toggle: { minHeight: 40, justifyContent: "center" },
});
