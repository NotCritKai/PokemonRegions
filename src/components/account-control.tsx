import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import {
  checkAuthStatus,
  fetchCloudData,
  getAuthToken,
  loginUser,
  loginWithOAuthCode,
  logoutUser,
  pushCloudData,
  registerUser,
  type User,
} from "@/utils/account-sync";

const CUSTOM_POKEMON_STORAGE_KEY = "custom-pokemon-options-v2";
const GIMMICKS_STORAGE_KEY = "pokemon-gimmicks";
const REGIONS_STORAGE_KEY = "pokemon-regions-v2";

export function AccountControl() {
  const [modalVisible, setModalVisible] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const isGoogle = window.location.pathname.includes("/google") || urlParams.has("scope");
      const isGithub = window.location.pathname.includes("/github") || (code && !urlParams.has("scope"));

      if (code && (isGoogle || isGithub)) {
        const provider = isGoogle ? "google" : "github";
        setModalVisible(true);
        setLoading(true);
        setError("");
        setSuccess(`Authenticating with ${provider === "google" ? "Google" : "GitHub"}...`);

        const redirectUri = isGoogle ? `${window.location.origin}/api/auth/google/callback` : undefined;
        loginWithOAuthCode(provider, code, redirectUri).then((res) => {
          setLoading(false);
          if (res.success && res.user) {
            setUser(res.user);
            setSuccess(`Signed in with ${provider === "google" ? "Google" : "GitHub"} as ${res.user.username}!`);
            window.history.replaceState({}, document.title, window.location.pathname);
            void handleSync("auto");
          } else {
            setError(res.error || "OAuth sign in failed");
          }
        });
      }
    }

    checkAuthStatus().then((u) => {
      setUser(u);
      if (u) {
        void handleSync("auto");
      }
    });
  }, []);

  async function handleSync(mode: "auto" | "pull" | "push" = "auto") {
    if (!getAuthToken()) return;
    setSyncStatus("Syncing with Cloudflare...");

    let localRegions = [];
    let customPkmn = [];
    let gimmicksList = [];
    if (typeof window !== "undefined") {
      try {
        const r = window.localStorage.getItem(REGIONS_STORAGE_KEY);
        if (r) localRegions = JSON.parse(r);
        const p = window.localStorage.getItem(CUSTOM_POKEMON_STORAGE_KEY);
        if (p) customPkmn = JSON.parse(p);
        const g = window.localStorage.getItem(GIMMICKS_STORAGE_KEY);
        if (g) gimmicksList = JSON.parse(g);
      } catch {}
    }

    if (mode === "push") {
      const res = await pushCloudData({ regions: localRegions, customPokemon: customPkmn, gimmicks: gimmicksList });
      if (res.success) {
        setSyncStatus("Pushed to Cloud!");
      } else {
        setSyncStatus(`Error: ${res.error}`);
      }
      return;
    }

    const res = await fetchCloudData();
    if (!res.success || !res.data) {
      setSyncStatus(`Error: ${res.error || "Fetch failed"}`);
      return;
    }

    const cloudRegions = res.data.regions || [];
    const cloudCustomPokemon = res.data.customPokemon || [];
    const cloudGimmicks = res.data.gimmicks || [];

    if (mode === "pull" || (mode === "auto" && cloudRegions.length > 0 && localRegions.length === 0)) {
      if (typeof window !== "undefined") {
        if (cloudRegions.length > 0) window.localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(cloudRegions));
        if (cloudCustomPokemon.length > 0) window.localStorage.setItem(CUSTOM_POKEMON_STORAGE_KEY, JSON.stringify(cloudCustomPokemon));
        if (cloudGimmicks.length > 0) window.localStorage.setItem(GIMMICKS_STORAGE_KEY, JSON.stringify(cloudGimmicks));
        window.location?.reload();
      }
      setSyncStatus("Pulled from Cloud!");
    } else if (mode === "auto") {
      const mergedMap = new Map<string, any>();
      cloudRegions.forEach((r: any) => { if (r.name) mergedMap.set(r.name, r); });
      localRegions.forEach((r: any) => { if (r.name) mergedMap.set(r.name, r); });
      const mergedRegions = Array.from(mergedMap.values());
      if (typeof window !== "undefined") {
        window.localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(mergedRegions));
      }
      await pushCloudData({ regions: mergedRegions, customPokemon: customPkmn, gimmicks: gimmicksList });
      setSyncStatus("Synced!");
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await loginUser(username.trim(), password);
    setLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      setSuccess(`Welcome back, ${res.user.username}!`);
      setPassword("");
      void handleSync("auto");
    } else {
      setError(res.error || "Login failed");
    }
  }

  async function handleRegister() {
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await registerUser(username.trim(), password);
    setLoading(false);
    if (res.success && res.user) {
      setUser(res.user);
      setSuccess(`Account created! Welcome, ${res.user.username}!`);
      setPassword("");
      void handleSync("push");
    } else {
      setError(res.error || "Registration failed");
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setSuccess("Logged out successfully.");
    setSyncStatus("");
  }

  function handleGoogleOAuth() {
    if (typeof window === "undefined") return;
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      setError("Google OAuth Client ID is not configured yet in app.json/env.");
      return;
    }
    const redirectUri = `${window.location.origin}/api/auth/google/callback`;
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20profile%20email`;
    window.open(googleUrl, "_self");
  }

  function handleGitHubOAuth() {
    if (typeof window === "undefined") return;
    const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || "";
    if (!clientId) {
      setError("GitHub OAuth Client ID is not configured yet in app.json/env.");
      return;
    }
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=user:email`;
    window.open(githubUrl, "_self");
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Account menu"
        accessibilityRole="button"
        onPress={() => {
          setError("");
          setSuccess("");
          setModalVisible(true);
        }}
        style={({ pressed }) => [
          styles.accountButton,
          user && styles.accountButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold" style={styles.personIcon}>
          👤
        </ThemedText>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.menuTitle}>
              {user ? "Cloud Sync Account" : accountMode === "login" ? "Sign In" : "Create Account"}
            </ThemedText>

            {user ? (
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Signed in as: {user.username}</ThemedText>
                {syncStatus ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {syncStatus}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={() => void handleSync("push")}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Push Local Data to Cloud</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => void handleSync("pull")}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Pull Cloud Data to Local</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => void handleLogout()}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Sign Out</ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.tabOptions}>
                  <Pressable
                    onPress={() => {
                      setAccountMode("login");
                      setError("");
                      setSuccess("");
                    }}
                    style={[
                      styles.tabOption,
                      accountMode === "login" && styles.tabOptionSelected,
                    ]}
                  >
                    <ThemedText type="smallBold">Sign In</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAccountMode("register");
                      setError("");
                      setSuccess("");
                    }}
                    style={[
                      styles.tabOption,
                      accountMode === "register" && styles.tabOptionSelected,
                    ]}
                  >
                    <ThemedText type="smallBold">Register</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold">Username</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setUsername}
                    placeholder="e.g. trainer_red"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    style={styles.input}
                    value={username}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <ThemedText type="smallBold">Password</ThemedText>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                </View>

                {error ? (
                  <ThemedText type="small" style={{ color: "#ff6b6b" }}>
                    {error}
                  </ThemedText>
                ) : null}

                {success ? (
                  <ThemedText type="small" style={{ color: "#51cf66" }}>
                    {success}
                  </ThemedText>
                ) : null}

                <Pressable
                  disabled={loading}
                  onPress={accountMode === "login" ? handleLogin : handleRegister}
                  style={({ pressed }) => [
                    styles.actionButton,
                    loading && styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    {loading
                      ? "Loading..."
                      : accountMode === "login"
                        ? "Sign In"
                        : "Create Account"}
                  </ThemedText>
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <ThemedText type="small" themeColor="textSecondary">
                    OR
                  </ThemedText>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.oauthContainer}>
                  <Pressable
                    onPress={handleGoogleOAuth}
                    style={({ pressed }) => [
                      styles.oauthButton,
                      styles.googleButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Sign in with Google</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={handleGitHubOAuth}
                    style={({ pressed }) => [
                      styles.oauthButton,
                      styles.githubButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">Sign in with GitHub</ThemedText>
                  </Pressable>
                </View>
              </>
            )}

            <Pressable
              onPress={() => setModalVisible(false)}
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
    </>
  );
}

const styles = StyleSheet.create({
  accountButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  accountButtonActive: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  personIcon: {
    fontSize: 16,
    lineHeight: 20,
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
    zIndex: 40,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    gap: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(120, 140, 180, 0.2)",
  },
  menuTitle: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  tabOptions: {
    flexDirection: "row",
    gap: 8,
  },
  tabOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  tabOptionSelected: {
    backgroundColor: "rgba(60, 135, 247, 0.8)",
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
  },
  actionButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(60, 135, 247, 0.88)",
  },
  secondaryAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  dangerButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(196, 77, 77, 0.8)",
  },
  closeButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  disabledButton: {
    opacity: 0.5,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  oauthContainer: {
    gap: 8,
  },
  oauthButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  googleButton: {
    backgroundColor: "#4285F4",
  },
  githubButton: {
    backgroundColor: "#24292e",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
});
