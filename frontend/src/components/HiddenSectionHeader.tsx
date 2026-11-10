import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// Title of the separate block at the very end of a list that holds its hidden categories or tags.
export function HiddenSectionHeader({ count }: { count: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.selected,
      }}
    >
      <MaterialCommunityIcons name="eye-off-outline" size={20} color={colors.textSecondary} />
      <AppText variant="label" secondary style={{ flex: 1 }}>
        {t("hide.section", { count })}
      </AppText>
    </View>
  );
}
