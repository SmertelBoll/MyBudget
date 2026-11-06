import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName } from "@/constants/appearance";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";

// Round "+" pinned to the bottom of list screens (spec 5.1, 7.1, 8.1): floats, so it stays fully round.
// "corner": inside a card, at its bottom right (the "+" on Home's chart, spec 2.2).
export function Fab({
  onPress,
  label,
  icon = "plus",
  placement = "screen",
  size = 64,
}: {
  onPress: () => void;
  label: string;
  icon?: IconName;
  placement?: "screen" | "corner";
  size?: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const position =
    placement === "corner"
      ? ({ position: "absolute", right: spacing.md, bottom: spacing.md } as const)
      : ({ position: "absolute", left: 0, right: 0, bottom: insets.bottom + spacing.md, alignItems: "center" } as const);
  return (
    <View pointerEvents="box-none" style={position}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <MaterialCommunityIcons name={icon} size={size / 2} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}
