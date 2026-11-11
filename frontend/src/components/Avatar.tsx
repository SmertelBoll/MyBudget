import { View } from "react-native";
import { CONTRAST_DARK } from "@/theme/palette";
import { AppIcon, isKnownIcon } from "./AppIcon";

// The user's avatar is an icon on a colored circle (spec screen 12), like categories and accounts.
export function Avatar({ icon, color, size = 48 }: { icon?: string; color?: string; size?: number }) {
  const name = icon && isKnownIcon(icon) ? icon : "account";
  const background = color ?? "#ffeb3b";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppIcon name={name} size={size * 0.55} color={CONTRAST_DARK} background={background} />
    </View>
  );
}
