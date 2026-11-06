import { useState } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { addDays, formatShortDate, todayLocal } from "@/utils/dates";
import { getLastUsedDate } from "@/data/transactions";
import { AppText } from "../AppText";
import { CalendarModal } from "../CalendarModal";

// Spec 4.5: Today, Yesterday and a third button. The third is the date entries were last added for in this run of
// the app (handy for typing in last week), or "2 days ago"; a date picked in the calendar takes its place.
export function DateChips({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [calendar, setCalendar] = useState(false);
  // Third button chosen once when the form opens, then replaced by calendar picks.
  const today = todayLocal();
  const yesterday = addDays(today, -1);
  const [third, setThird] = useState(() => {
    const last = getLastUsedDate();
    if (last && last !== today && last !== yesterday) return last;
    if (value !== today && value !== yesterday) return value;
    return addDays(today, -2);
  });

  const chips = [
    { date: today, label: t("dates.today") },
    { date: yesterday, label: t("dates.yesterday") },
    { date: third, label: third === addDays(today, -2) ? t("dates.twoDaysAgo") : null },
  ];

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{t("entry.date")}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {chips.map((chip) => {
          const active = chip.date === value;
          return (
            <Pressable
              key={chip.date}
              onPress={() => onChange(chip.date)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: active ? colors.accent : pressed ? colors.selected : colors.surface,
              })}
            >
              <AppText variant="heading" color={active ? colors.onAccent : undefined}>
                {formatShortDate(chip.date, lang)}
              </AppText>
              <AppText variant="caption" color={active ? colors.onAccent : colors.textSecondary} numberOfLines={1}>
                {chip.label ?? " "}
              </AppText>
            </Pressable>
          );
        })}
        {/* A full-height tile like the chips, not a small round button: easy to hit. */}
        <Pressable
          onPress={() => setCalendar(true)}
          accessibilityRole="button"
          accessibilityLabel={t("dates.pick")}
          style={({ pressed }) => ({
            alignSelf: "stretch",
            width: 64,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.selected : colors.tonal,
          })}
        >
          <MaterialCommunityIcons name="calendar-month-outline" size={28} color={colors.text} />
        </Pressable>
      </View>
      {calendar && (
        <CalendarModal
          visible
          value={value}
          onClose={() => setCalendar(false)}
          onChange={(date) => {
            if (date !== today && date !== yesterday) setThird(date);
            onChange(date);
          }}
        />
      )}
    </View>
  );
}
