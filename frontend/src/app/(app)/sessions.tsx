import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ApiError, api, isNetworkError } from "@/api/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatLongDate, toLocalDate } from "@/utils/dates";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { useDialog } from "@/components/AppDialog";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";

type Session = {
  id: string;
  deviceName: string;
  platform: "ios" | "android" | "web" | "other";
  appVersion: string;
  location: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
  // The name the device reported; deviceName is the user's own name when renamed.
  originalName?: string;
  renamed?: boolean;
};

const PLATFORM_ICON = { ios: "apple-ios", android: "android", web: "web", other: "devices" } as const;

const formatMoment = (iso: string, lang: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatLongDate(toLocalDate(date), lang)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function SessionCard({ session, onEnd, onRename }: { session: Session; onEnd: () => void; onRename: () => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const details = [t(`sessions.platform.${session.platform}`), session.appVersion && (/^\d/.test(session.appVersion) ? `v${session.appVersion}` : session.appVersion), session.location].filter(Boolean).join(" · ");
  return (
    <View
      style={{
        padding: spacing.md,
        gap: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: session.isCurrent ? 1.5 : 0,
        borderColor: colors.mark,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <MaterialCommunityIcons name={PLATFORM_ICON[session.platform] ?? "devices"} size={24} color={colors.text} />
        <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
          {session.deviceName || t("sessions.unknownDevice")}
        </AppText>
        {session.isCurrent && (
          <AppText variant="caption" color={colors.mark}>
            {t("sessions.thisDevice")}
          </AppText>
        )}
        <IconButton icon="pencil-outline" label={t("sessions.rename")} onPress={onRename} size={36} />
      </View>
      {details ? (
        <AppText variant="caption" secondary>
          {details}
        </AppText>
      ) : null}
      <AppText variant="caption" secondary>
        {t("sessions.lastActive", { when: formatMoment(session.lastActiveAt, lang) })}
      </AppText>
      <AppText variant="caption" secondary>
        {t("sessions.signedIn", { when: formatMoment(session.createdAt, lang) })}
      </AppText>
      {!session.isCurrent && <Button title={t("sessions.end")} icon="logout" variant="secondary" onPress={onEnd} style={{ marginTop: spacing.sm }} />}
    </View>
  );
}

// Settings -> Security and sessions (spec 3.3, 13.5). Online only; refreshed on opening and by pulling down.
export default function SessionsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const dialog = useDialog();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      api.get<{ sessions: Session[] }>("/sessions").then(
        ({ sessions: list }) => {
          setSessions(list);
          setOffline(false);
        },
        (error) => {
          if (isNetworkError(error)) setOffline(true);
          else toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });
        }
      ),
    [t, toast]
  );

  useEffect(() => {
    let alive = true;
    api.get<{ sessions: Session[] }>("/sessions").then(
      ({ sessions: list }) => alive && setSessions(list),
      (error) => alive && isNetworkError(error) && setOffline(true)
    );
    return () => {
      alive = false;
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const fail = (error: unknown) => toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });

  const endOne = async (session: Session) => {
    const ok = await dialog.confirm({
      title: t("sessions.endTitle"),
      message: t("sessions.endMessage", { device: session.deviceName || t("sessions.unknownDevice") }),
      confirmText: t("sessions.end"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del(`/sessions/${session.id}`);
      setSessions((list) => list?.filter((item) => item.id !== session.id) ?? null);
      toast.show(t("sessions.ended"));
    } catch (error) {
      fail(error);
    }
  };

  const saveName = async (session: Session, name: string | null) => {
    try {
      await api.patch("/sessions/" + session.id, { name });
      const shown = name ?? session.originalName ?? session.deviceName;
      setSessions((list) => list?.map((item) => (item.id === session.id ? { ...item, deviceName: shown, renamed: name !== null } : item)) ?? null);
    } catch (error) {
      fail(error);
    }
  };

  // A renamed session also offers to go back to the device's own name.
  const rename = async (session: Session) => {
    if (session.renamed) {
      const choice = await dialog.choose({
        title: session.deviceName,
        options: [
          { value: "rename", label: t("sessions.rename") },
          { value: "reset", label: t("sessions.resetName", { name: session.originalName || t("sessions.unknownDevice") }) },
        ],
      });
      if (choice === "reset") return saveName(session, null);
      if (choice !== "rename") return;
    }
    const name = await dialog.prompt({
      title: t("sessions.rename"),
      label: t("sessions.name"),
      initial: session.deviceName,
      maxLength: 60,
    });
    if (!name || name === session.deviceName) return;
    await saveName(session, name);
  };

  const endOthers = async () => {
    const ok = await dialog.confirm({
      title: t("sessions.endOthersTitle"),
      message: t("sessions.endOthersMessage"),
      confirmText: t("sessions.endOthers"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del("/sessions/others");
      setSessions((list) => list?.filter((item) => item.isCurrent) ?? null);
      toast.show(t("sessions.endedOthers"));
    } catch (error) {
      fail(error);
    }
  };

  const others = sessions?.filter((session) => !session.isCurrent).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("sessions.title")} left="back" />
      {offline && !sessions ? (
        <View style={{ alignItems: "center", gap: spacing.sm, padding: spacing.xl }}>
          <MaterialCommunityIcons name="wifi-off" size={48} color={colors.textSecondary} />
          <AppText secondary style={{ textAlign: "center" }}>
            {t("common.noInternet")}
          </AppText>
          <Button title={t("sessions.retry")} variant="secondary" onPress={refresh} loading={refreshing} />
        </View>
      ) : (
        <FlatList
          data={sessions ?? []}
          keyExtractor={(session) => session.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} tintColor={colors.accent} />}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
          renderItem={({ item }) => <SessionCard session={item} onEnd={() => endOne(item)} onRename={() => rename(item)} />}
          ListFooterComponent={
            others > 0 ? <Button title={t("sessions.endOthers")} icon="logout-variant" variant="danger" onPress={endOthers} style={{ marginTop: spacing.md }} /> : undefined
          }
        />
      )}
    </View>
  );
}
