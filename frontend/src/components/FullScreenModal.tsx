import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// A full-screen picker window (lists, icons, colors, calendar) with the same header shape as ScreenHeader.
export function FullScreenModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: spacing.sm,
            backgroundColor: colors.surface,
            borderBottomLeftRadius: radius.lg,
            borderBottomRightRadius: radius.lg,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={{ padding: spacing.sm }}
          >
            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
          </Pressable>
          <AppText variant="title" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </AppText>
        </View>
        {children}
      </View>
    </Modal>
  );
}
