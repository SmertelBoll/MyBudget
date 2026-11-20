import { ActivityIndicator, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSyncState } from "@/data/hooks";
import { requestSync } from "@/data/sync";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { formatNumericDate, toLocalDate, type DateFormat } from "@/utils/dates";
import { useDateFormat } from "@/utils/useDateFormat";
import { AppText } from "./AppText";

const formatTime = (iso: string, lang: string, dateFormat: DateFormat) => {
  const date = new Date(iso);
  let time: string;
  try {
    time = new Intl.DateTimeFormat(lang, { timeStyle: "short" }).format(date);
  } catch {
    time = date.toLocaleTimeString();
  }
  return `${formatNumericDate(toLocalDate(date), dateFormat)}, ${time}`;
};

// Spec 4.1: "Synced / N waiting / Sync error" at the bottom of the side menu. Tapping it syncs now.
export function SyncIndicator() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const dateFormat = useDateFormat();
  const { status, pending, lastSyncedAt, errorCode } = useSyncState();

  let icon: keyof typeof MaterialCommunityIcons.glyphMap = "sync";
  let color = colors.textSecondary;
  let text: string;
  if (status === "syncing") {
    text = t("sync.syncing");
  } else if (status === "error") {
    icon = "sync-alert";
    color = colors.danger;
    text = t(errorCode === "common.timeout" ? "sync.slow" : "sync.error");
  } else if (status === "offline") {
    icon = "cloud-off-outline";
    text = pending ? t("sync.pending", { count: pending }) : t("sync.offline");
  } else if (pending) {
    icon = "cloud-upload-outline";
    text = t("sync.pending", { count: pending });
  } else {
    text = lastSyncedAt ? t("sync.synced", { time: formatTime(lastSyncedAt, lang, dateFormat) }) : t("sync.never");
  }

  return (
    <Pressable
      onPress={() => requestSync()}
      accessibilityRole="button"
      accessibilityHint={t("sync.retry")}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}
    >
      {status === "syncing" ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      )}
      <AppText variant="caption" color={color} style={{ flex: 1 }}>
        {text}
      </AppText>
    </Pressable>
  );
}
