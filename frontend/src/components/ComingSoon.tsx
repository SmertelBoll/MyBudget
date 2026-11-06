import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { ScreenHeader } from "./ScreenHeader";

// Placeholder for screens of later stages.
export function ComingSoon({ title, icon }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={title} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <MaterialCommunityIcons name={icon} size={56} color={colors.textSecondary} />
        <AppText secondary>{t("common.comingSoon")}</AppText>
      </View>
    </View>
  );
}
