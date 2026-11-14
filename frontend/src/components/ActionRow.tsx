import { useState, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";

// A list row with buttons of its own at the sides (a delete button, a checkbox...). The buttons sit next to the row,
// not inside it: a button inside a button isn't allowed and confuses screen readers. While the row is held the whole
// line lights up, the side buttons' area included, not just the part under the finger (the highlight is on the
// outer box, as on Home's rows).
export function ActionRow({
  onPress,
  children,
  leading,
  trailing,
  accessibilityHint,
  style,
  contentStyle,
  background,
}: {
  onPress: () => void;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityHint?: string;
  // The outer box: margins, border, opacity...
  style?: StyleProp<ViewStyle>;
  // The pressable middle: padding, gap...
  contentStyle?: StyleProp<ViewStyle>;
  // Background when not pressed (defaults to the surface colour).
  background?: string;
}) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", borderRadius: radius.md, overflow: "hidden", backgroundColor: pressed ? colors.selected : (background ?? colors.surface) },
        style,
      ]}
    >
      {leading}
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        style={[{ flex: 1, flexDirection: "row", alignItems: "center" }, contentStyle]}
      >
        {children}
      </Pressable>
      {trailing}
    </View>
  );
}
