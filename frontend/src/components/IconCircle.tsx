import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconName } from "@/constants/appearance";
import { CONTRAST_DARK, CONTRAST_LIGHT } from "@/theme/palette";

// Readable icon color on any background: dark on light colors, light on dark ones.
export const contrastOn = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? CONTRAST_DARK : CONTRAST_LIGHT;
};

// An icon on a colored circle: accounts, categories, the avatar (spec 2.9 ListRow).
export function IconCircle({
  icon,
  color,
  size = 44,
  dimmed,
}: {
  icon: string;
  color: string;
  size?: number;
  dimmed?: boolean;
}) {
  const name = (icon in MaterialCommunityIcons.glyphMap ? icon : "help") as IconName;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <MaterialCommunityIcons name={name} size={size * 0.55} color={contrastOn(color)} />
    </View>
  );
}
