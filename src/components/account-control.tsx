import { saveVersion, readVersions, BACKUP_TIME_KEY, type SavedVersion } from "@/utils/save-history";
import { downloadBackup } from "./backup-restore";
import { confirmDeleteAction } from "@/utils/delete-confirmation";
import { syncAccount } from "@/utils/sync-engine";
import { subscribeToSaving, hasUnsavedData, restoreBackup } from "@/utils/local-data";
import { lastCloudSaveKey } from "@/utils/cloud-save-status";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import {
  checkAuthStatus,
  loginUser,
  logoutUser,
  registerUser,
  type User,
} from "@/utils/account-sync";


export function AccountControl() {
  const [modalVisible, setModalVisible] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [backupDue, setBackupDue] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [lastCloudSave, setLastCloudSave] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const pendingAuto = useRef(false);

  function loadLastCloudSave(userId: string) {
    try {
      const value = Number(window.localStorage.getItem(lastCloudSaveKey(userId)));
      setLastCloudSave(Number.isFinite(value) && value > 0 ? value : null);
    } catch { setLastCloudSave(null); }
  }



  const handleSync = useCallback(async function runSync(mode: "auto" | "pull" | "push" = "auto") {
    if (syncInFlight.current) { if (mode === "auto") pendingAuto.current = true; return; }
    syncInFlight.current = true;
    setSyncing(true);
    try {
      setSyncStatus("Checking cloud data…");
      const result = await syncAccount(mode);
      setSyncStatus(result.message);
      setVersions(readVersions());
      if (result.savedAt) setLastCloudSave(result.savedAt);
      if (result.dirty) pendingAuto.current = true;
      if (result.reload) window.location.reload();
    } catch (cause) {
      setSyncStatus(cause instanceof Error ? cause.message : "Cloud save failed. Your local data is kept.");
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
      if (pendingAuto.current) { pendingAuto.current = false; void runSync("auto"); }
    }
  }, []);

  useEffect(() => {
    checkAuthStatus().then((u) => {
      setUser(u);
      if (u) {
        loadLastCloudSave(u.id);
        void handleSync("auto");
      }
    });
  }, [handleSync]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      setSyncStatus(hasUnsavedData() ? "Local saving needs a retry." : "Saved locally. Cloud save pending when signed in.");
      timer = setTimeout(() => {
        try { saveVersion("Device checkpoint"); setVersions(readVersions()); }
        catch { setSyncStatus("Saved data could not be added to version history. Export a backup and check browser storage."); return; }
        void handleSync("auto");
      }, 1500);
    };
    const unsubscribe = subscribeToSaving(schedule);
    if (typeof window !== "undefined") window.addEventListener("online", schedule);
    return () => {
      clearTimeout(timer); unsubscribe();
      if (typeof window !== "undefined") window.removeEventListener("online", schedule);
    };
  }, [handleSync]);

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
      loadLastCloudSave(res.user.id);
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
      loadLastCloudSave(res.user.id);
      setSuccess(`Account created! Welcome, ${res.user.username}!`);
      setPassword("");
      void handleSync("auto");
    } else {
      setError(res.error || "Registration failed");
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setLastCloudSave(null);
    setSuccess("Logged out successfully.");
    setSyncStatus("");
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Account menu"
        accessibilityRole="button"
        onPress={() => {
          setError("");
          setSuccess("");
          try {
            setVersions(readVersions());
            setBackupDue(Date.now() - Number(window.localStorage.getItem(BACKUP_TIME_KEY) ?? 0) > 7 * 86400000);
          } catch { setSyncStatus("Version history is unavailable. Export a backup before syncing."); }
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

            <ScrollView style={{maxHeight: 460}} contentContainerStyle={{gap: 12}}>
            {!user && syncStatus ? <ThemedText type="small">{syncStatus}</ThemedText> : null}
            {backupDue ? <ThemedText type="small">Backup reminder: download a full backup before clearing browser data. Local version history is erased with site data too.</ThemedText> : null}
            <Pressable accessibilityRole="button" onPress={() => {downloadBackup(); setBackupDue(false);}} style={styles.secondaryAction}><ThemedText>Export All Data</ThemedText></Pressable>
            {versions.length ? <ThemedText type="smallBold">Recent versions · up to 10 on this browser</ThemedText> : null}
            {versions.map(version => <Pressable key={version.id} accessibilityRole="button" style={styles.secondaryAction} disabled={syncing} onPress={() => confirmDeleteAction({title: "Restore earlier version?", message: "This replaces this browser's saved collections and reloads. The current copy is saved to history first.", onConfirm: () => {
              try { saveVersion("Before restoring a version"); restoreBackup(version.storage); window.location.reload(); }
              catch {setSyncStatus("Restore failed. Export a backup and check browser storage.");}
            }})}><ThemedText type="small">Restore {version.label} · {new Date(version.at).toLocaleString()}</ThemedText></Pressable>)}
            {user ? (
              <View style={styles.fieldGroup}>
                <ThemedText type="smallBold">Signed in as: {user.username}</ThemedText>
                <ThemedText type="small">{lastCloudSave ? `Last confirmed cloud save: ${new Date(lastCloudSave).toLocaleString()}` : "No confirmed cloud save recorded on this browser."}</ThemedText>
                <ThemedText type="small">Cloud saving covers regions, custom Pokémon, and gimmicks. Export All Data also protects standalone music, saved Pokémon, and recovery copies.</ThemedText>
                {syncStatus ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {syncStatus}
                  </ThemedText>
                ) : null}

                <Pressable
                  disabled={syncing}
                  onPress={() => confirmDeleteAction({title: "Use this device's copy?", message: "This replaces cloud regions, custom Pokémon, and gimmicks. A copy of the previous cloud data is saved in local version history first. Export a backup before proceeding.", onConfirm: () => { void handleSync("push"); }})}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Use This Device’s Copy</ThemedText>
                </Pressable>

                <Pressable
                  disabled={syncing}
                  onPress={() => confirmDeleteAction({title: "Use the cloud copy?", message: "This replaces those collections on this device and reloads the app. A local version will be saved first.", onConfirm: () => { void handleSync("pull"); }})}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">Use Cloud Copy</ThemedText>
                </Pressable>

                <Pressable
                  disabled={syncing}
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
              </>
            )}

            </ScrollView>
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
});
