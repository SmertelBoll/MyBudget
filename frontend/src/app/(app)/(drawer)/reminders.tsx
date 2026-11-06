import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCollection } from "@/data/hooks";
import { setReminderActive } from "@/data/recurring";
import { reportWriteError } from "@/data/store";
import type { Reminder } from "@/data/types";
import { useI18n } from "@/i18n/I18nProvider";
import { requestNotificationPermission } from "@/notifications/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatLongDate } from "@/utils/dates";
import { describeRule } from "@/utils/repeat";
import { atMinute, nextOccurrence } from "@/utils/schedule";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useClock } from "@/utils/useClock";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { HeaderSearchInput } from "@/components/HeaderSearchInput";
import { IconButton } from "@/components/IconButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "@/components/ToggleRow";

// Screen 9: reminders only notify, they never add entries. Search, an "Active" switch on each, "+" at the bottom.
export default function RemindersScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const reminders = useCollection("reminders");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const now = useClock();
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reminders
      .filter((reminder) => !needle || reminder.title.toLowerCase().includes(needle) || reminder.comment.toLowerCase().includes(needle))
      .map((reminder) => ({ reminder, next: nextOccurrence(reminder, atMinute(now)) }))
      .sort((a, b) => {
        if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : a.reminder.title.localeCompare(b.reminder.title);
        return `${a.next.date} ${a.next.time}`.localeCompare(`${b.next.date} ${b.next.time}`);
      });
  }, [reminders, query, now]);

  const toggle = async (reminder: Reminder, on: boolean) => {
    setReminderActive(reminder, on).catch(reportWriteError);
    if (on && !(await requestNotificationPermission())) toast.show(t("recurring.notificationsOff"), { kind: "error" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("reminders.title")}
        center={searching ? <HeaderSearchInput value={query} onChangeText={setQuery} placeholder={t("reminders.search")} /> : undefined}
        right={
          <IconButton
            icon={searching ? "close" : "magnify"}
            label={t(searching ? "common.close" : "reminders.search")}
            onPress={() => {
              setSearching(!searching);
              setQuery("");
            }}
          />
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.reminder.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <MaterialCommunityIcons name="bell-outline" size={48} color={colors.textSecondary} />
            <AppText secondary>{t(query ? "logs.noResults" : "reminders.empty")}</AppText>
          </View>
        }
        renderItem={({ item: { reminder, next } }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: reminder.id } })}
            accessibilityRole="button"
            style={({ pressed }) => ({
              padding: spacing.md,
              gap: 4,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.selected : colors.surface,
              opacity: reminder.active ? 1 : 0.6,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                {reminder.title}
              </AppText>
              <ToggleRow label={t("reminders.active")} value={reminder.active} onChange={(on) => toggle(reminder, on)} hideLabel />
            </View>
            <AppText variant="caption" secondary numberOfLines={1}>
              {describeRule(reminder.rule, t, lang)}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <MaterialCommunityIcons name="bell-outline" size={16} color={colors.textSecondary} />
              <AppText variant="caption" secondary style={{ flex: 1, textTransform: "capitalize" }} numberOfLines={1}>
                {next ? `${formatLongDate(next.date, lang)}, ${next.time}` : t("recurring.finished")}
              </AppText>
            </View>
          </Pressable>
        )}
      />
      <Fab label={t("reminders.add")} onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: "new" } })} />
    </View>
  );
}
