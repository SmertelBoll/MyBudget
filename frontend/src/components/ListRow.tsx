import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { IconCircle } from "./IconCircle";

type Props = {
  icon: string;
  color: string;
  title: string;
  // One line, cut with "…": a long note never makes the row taller (spec 5.1).
  note?: string;
  value?: string;
  valueColor?: string;
  // Small icons before the value, e.g. "not in Total".
  badges?: ReactNode;
  // Removed account: greyed out (spec 5.3).
  dimmed?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

// One row for accounts, categories, payments and logs (spec 2.9).
export function ListRow({ icon, color, title, note, value, valueColor, badges, dimmed, onPress, onLongPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 64,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : colors.surface,
      })}
    >
      <IconCircle icon={icon} color={color} dimmed={dimmed} />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} color={dimmed ? colors.textSecondary : undefined}>
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" secondary numberOfLines={1}>
            {note}
          </AppText>
        ) : null}
      </View>
      {badges}
      {value !== undefined && (
        <AppText variant="heading" color={valueColor ?? (dimmed ? colors.textSecondary : undefined)} numberOfLines={1}>
          {value}
        </AppText>
      )}
    </Pressable>
  );
}
