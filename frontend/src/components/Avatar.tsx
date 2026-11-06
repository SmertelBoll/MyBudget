import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CONTRAST_DARK } from "@/theme/palette";

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

// The user's avatar is an icon on a colored circle (spec screen 12), like categories and accounts.
export function Avatar({ icon, color, size = 48 }: { icon?: string; color?: string; size?: number }) {
  const name = (icon && icon in MaterialCommunityIcons.glyphMap ? icon : "account") as Icon;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? "#ffeb3b",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={name} size={size * 0.55} color={CONTRAST_DARK} />
    </View>
  );
}
