import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

type Props = {
  title?: string;
  // Replaces the title, e.g. Home's account selector.
  center?: ReactNode;
  // "menu" opens the side drawer (top-level screens), "back" leaves the screen (forms and nested screens).
  left?: "menu" | "back" | "none";
  // Replaces the default back action, e.g. to ask "leave without saving?" first.
  onBack?: () => void;
  right?: ReactNode;
  // Extra rows under the title row, e.g. the Expenses / Income switch.
  children?: ReactNode;
};

// With a centered block (Transactions, Home) both sides get this same width, so the block sits in the middle of the
// screen even with one button on the left and two on the right. Fits two header icons.
const SIDE = 80;

// One header for every screen (spec 2.9): rounded bottom corners, safe-area aware.
export function ScreenHeader({ title, center, left = "menu", onBack, right, children }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const onLeft = () => {
    if (left === "menu") navigation.dispatch({ type: "OPEN_DRAWER" });
    else if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomLeftRadius: radius.lg,
        borderBottomRightRadius: radius.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: spacing.sm }}>
        <View style={center ? { width: SIDE, flexDirection: "row" } : undefined}>
        {left !== "none" && (
          <Pressable
            onPress={onLeft}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(left === "menu" ? "nav.openMenu" : "common.back")}
            style={{ padding: spacing.sm }}
          >
            <MaterialCommunityIcons name={left === "menu" ? "menu" : "arrow-left"} size={26} color={colors.text} />
          </Pressable>
        )}
        </View>
        {center ? (
          <View style={{ flex: 1, alignItems: "center" }}>{center}</View>
        ) : (
          <AppText variant="title" numberOfLines={1} style={{ flex: 1, marginHorizontal: spacing.sm }}>
            {title}
          </AppText>
        )}
        {center ? <View style={{ width: SIDE, flexDirection: "row", justifyContent: "flex-end" }}>{right}</View> : right}
      </View>
      {children}
    </View>
  );
}
