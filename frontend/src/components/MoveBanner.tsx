import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";

// Shown while an item is lifted by a long press: tap another item to put it in that place (spec 5.1, 7.1).
export function MoveBanner({ name, onCancel }: { name: string; onCancel: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        paddingLeft: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.tonal,
      }}
    >
      <MaterialCommunityIcons name="cursor-move" size={22} color={colors.text} />
      <AppText style={{ flex: 1 }}>{t("order.moveHint", { name })}</AppText>
      <Button variant="text" title={t("common.cancel")} onPress={onCancel} />
    </View>
  );
}
