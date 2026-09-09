import { Alert, Platform } from "react-native";

const DELETE_CONFIRMATIONS_KEY = "pokemon-delete-confirmations-enabled";

export function areDeleteConfirmationsEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(DELETE_CONFIRMATIONS_KEY);
  return stored !== "false";
}

export function setDeleteConfirmationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    DELETE_CONFIRMATIONS_KEY,
    enabled ? "true" : "false",
  );
}

export function confirmDeleteAction({
  title,
  message,
  onConfirm,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  if (!areDeleteConfirmationsEnabled()) {
    onConfirm();
    return;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const shouldDelete = window.confirm(`${title}\n\n${message}`);
    if (shouldDelete) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: onConfirm,
    },
    {
      text: "Don't ask again",
      style: "default",
      onPress: () => {
        setDeleteConfirmationsEnabled(false);
        onConfirm();
      },
    },
  ]);
}
