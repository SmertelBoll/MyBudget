import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// A pickable row with a check mark: languages, currencies.
export function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
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
        backgroundColor: pressed ? colors.selected : "transparent",
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
      {selected && <MaterialCommunityIcons name="check" size={22} color={colors.text} />}
    </Pressable>
  );
}
