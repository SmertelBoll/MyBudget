import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts } from "@/theme/tokens";

// Text logo with the same proportions as the MovieList header: "My" plain, "Budget" on a yellow plate. Line height
// equals the font size and the plate's padding is small, as on the site (lineHeight 1, padding 4px 6px, radius 8).
export function LogoText({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  const text = { fontFamily: fonts.logo, fontSize: size, lineHeight: size, includeFontPadding: false } as const;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }} accessibilityRole="header" accessibilityLabel="MyBudget">
      <Text style={[text, { color: colors.text }]}>My</Text>
      <View
        style={{
          marginLeft: size * 0.15,
          paddingHorizontal: size * 0.21,
          paddingVertical: size * 0.14,
          borderRadius: size * 0.28,
          backgroundColor: colors.accent,
        }}
      >
        <Text style={[text, { color: colors.onAccent }]}>Budget</Text>
      </View>
    </View>
  );
}
