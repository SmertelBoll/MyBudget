import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "danger" | "text";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  // Looks inactive but still reacts, so pressing it can show what's missing (spec 2.7).
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, muted, style }: Props) {
  const { colors } = useTheme();

  const palette = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: "transparent", pressed: colors.selected, fg: colors.text, border: colors.selected },
    danger: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.onDanger, border: colors.danger },
    text: { bg: "transparent", pressed: colors.selected, fg: colors.text, border: "transparent" },
  }[variant];
  const dimmed = muted || disabled;
  const bg = variant === "primary" && dimmed ? colors.accentMuted : palette.bg;
  const fg = variant === "primary" && dimmed ? colors.onAccentMuted : palette.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: pressed && !dimmed ? palette.pressed : bg,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon && <MaterialCommunityIcons name={icon} size={20} color={fg} />}
          <AppText variant="label" color={fg} style={{ fontSize: 16 }}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
