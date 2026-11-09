import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName } from "@/constants/appearance";
import { useTheme } from "@/theme/ThemeProvider";

// A small round button next to a value (balance details, calculator, convert, ±). It has its own darker
// background so it reads as something to tap, not as decoration.
export function IconButton({
  icon,
  label,
  onPress,
  size = 40,
  active,
  plain,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  // Highlighted state, e.g. "−" switched on.
  active?: boolean;
  // No background of its own (header icons that sit side by side); shaded only while pressed.
  plain?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? colors.accent : pressed ? colors.selected : plain ? "transparent" : colors.tonal,
      })}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.55} color={active ? colors.onAccent : colors.text} />
    </Pressable>
  );
}
