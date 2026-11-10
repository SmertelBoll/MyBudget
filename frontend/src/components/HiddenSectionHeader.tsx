import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// The fold under a list that holds its hidden categories or tags: closed by default, so they stay out of the way.
export function HiddenSectionHeader({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 48,
        paddingHorizontal: spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <MaterialCommunityIcons name="eye-off-outline" size={20} color={colors.textSecondary} />
      <AppText variant="label" secondary style={{ flex: 1 }}>
        {t("hide.section", { count })}
      </AppText>
      <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.textSecondary} />
    </Pressable>
  );
}
