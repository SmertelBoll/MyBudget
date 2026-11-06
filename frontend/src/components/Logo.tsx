import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/tokens";
import { AppText } from "./AppText";

// The MovieList favicon (yellow rounded square with a stroked letter) with B instead of M (spec 2.3).
export function LogoMark({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={14} fill={colors.accent} />
      <Path
        d="M22 16v32M22 16h11a8 8 0 0 1 0 16H22M22 32h13a8 8 0 0 1 0 16H22"
        fill="none"
        stroke={colors.onAccent}
        strokeWidth={7.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Text logo like the site's header: "My" plain, "Budget" on a yellow plate.
export function LogoText() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <AppText style={{ fontFamily: fonts.logo, fontSize: 26 }}>My</AppText>
      <View style={{ backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6 }}>
        <AppText style={{ fontFamily: fonts.logo, fontSize: 26 }} color={colors.onAccent}>
          Budget
        </AppText>
      </View>
    </View>
  );
}
