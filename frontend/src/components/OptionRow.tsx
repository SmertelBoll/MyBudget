import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// A pickable row: name on the left, an optional code on the right (currencies); the chosen row is highlighted.
export function OptionRow({
  title,
  subtitle,
  trailing,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed ? colors.selected : selected ? colors.surface : "transparent",
      })}
    >
      <View style={{ flex: 1 }}>
        <AppText>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" secondary numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <AppText variant="label" secondary>
          {trailing}
        </AppText>
      ) : null}
    </Pressable>
  );
}
