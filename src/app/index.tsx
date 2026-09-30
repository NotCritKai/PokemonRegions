import { Link } from "expo-router";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { HintRow } from "@/components/hint-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          style={styles.scrollView}
        >
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon />
            <ThemedText type="title" style={styles.title}>
              Pokemon Regions
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
              Build a region, track your team, and shape your own Pokémon world.
            </ThemedText>
          </ThemedView>

          <ThemedText type="code" style={styles.code}>
            Get Started
          </ThemedText>

          <ThemedText type="small" style={styles.storageHint}>
            Your data is saved in this browser only. Use the settings gear in the
            top-right to reset everything whenever you want. Export your regions
            before clearing browser site data so you have a backup.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.stepContainer}>
            <HintRow
              title="Create A Region"
              hint={
                <Link href="/my-regions" asChild>
                  <ThemedText type="code">Regions Tab</ThemedText>
                </Link>
              }
            />
            <HintRow
              title="Create A Pokemon"
              hint={
                <Link href="/my-pokemon" asChild>
                  <ThemedText type="code">Pokemon Tab</ThemedText>
                </Link>
              }
            />
            <HintRow
              title="Create A Gimmick"
              hint={
                <Link href="/my-gimmicks" asChild>
                  <ThemedText type="code">Gimmicks Tab</ThemedText>
                </Link>
              }
            />
            <HintRow
              title="Add Music"
              hint={
                <Link href="/my-music" asChild>
                  <ThemedText type="code">Music Tab</ThemedText>
                </Link>
              }
            />
          </ThemedView>

          {Platform.OS === "web" && <WebBadge />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    width: "100%",
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    paddingTop: Spacing.three,
    flexGrow: 1,
  },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  title: {
    textAlign: "center",
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    maxWidth: 420,
    textAlign: "center",
    lineHeight: 22,
  },
  code: {
    textTransform: "uppercase",
    letterSpacing: 1.2,
    opacity: 0.84,
  },
  storageHint: {
    textAlign: "center",
    opacity: 0.72,
    maxWidth: 520,
    paddingHorizontal: Spacing.two,
    lineHeight: 22,
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.18)",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
