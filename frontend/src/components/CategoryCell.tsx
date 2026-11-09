import { Pressable, View, type DimensionValue } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { IconCircle } from "./IconCircle";

// One category in a 4-per-row grid (spec 4.4, 7.1): colored circle and the name under it.
export function CategoryCell({
  icon,
  color,
  label,
  onPress,
  onLongPress,
  picked,
  selected,
  width = "25%",
}: {
  icon: string;
  color: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  // Lifted for moving (long press).
  picked?: boolean;
  // Chosen in a form.
  selected?: boolean;
  // "100%" when a wrapper (the drag-and-drop grid) already takes a quarter.
  width?: DimensionValue;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected || picked) }}
      style={({ pressed }) => ({
        width,
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: 2,
        borderRadius: radius.md,
        backgroundColor: picked ? colors.tonal : pressed ? colors.selected : "transparent",
        opacity: picked ? 0.85 : 1,
      })}
    >
      {/* Chosen: a round ring around the round icon (no square frame). */}
      <View
        style={{
          padding: 3,
          borderRadius: 34,
          borderWidth: 2,
          borderColor: selected ? colors.mark : "transparent",
          transform: [{ scale: picked ? 1.1 : 1 }],
        }}
      >
        <IconCircle icon={icon} color={color} size={52} />
      </View>
      <AppText variant="caption" numberOfLines={1} style={{ textAlign: "center" }} color={selected ? colors.text : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}
