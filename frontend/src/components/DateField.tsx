import { useState } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { addDays, formatLongDate, todayLocal } from "@/utils/dates";
import { AppText } from "./AppText";
import { CalendarModal } from "./CalendarModal";

// "Today, 5 November 2026 (Thu)" that opens the calendar (screen 10). Screen 4 gets its own three-button variant.
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (date: string) => void }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  const today = todayLocal();
  const relative = value === today ? t("dates.today") : value === addDays(today, -1) ? t("dates.yesterday") : null;
  const text = relative ? `${relative}, ${formatLongDate(value, lang)}` : formatLongDate(value, lang);

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.selected,
          backgroundColor: pressed ? colors.selected : colors.surface,
        })}
      >
        <AppText style={{ flex: 1 }}>{text}</AppText>
        <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.textSecondary} />
      </Pressable>
      {open && <CalendarModal visible value={value} onClose={() => setOpen(false)} onChange={onChange} />}
    </View>
  );
}
