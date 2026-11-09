import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "../AppText";

export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>{children}</View>
    </View>
  );
}

// A row that opens another screen or runs an action.
export function SettingsLink({
  icon,
  label,
  hint,
  onPress,
  danger,
  disabled,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 48,
        marginHorizontal: -spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.selected : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color={color}>{label}</AppText>
        {hint ? (
          <AppText variant="caption" secondary>
            {hint}
          </AppText>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

