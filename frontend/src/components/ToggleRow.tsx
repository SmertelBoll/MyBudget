import { useEffect, useState } from "react";
import { Animated, Easing, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB = 22;
const TRAVEL = TRACK_WIDTH - THUMB - 6;
const DURATION_MS = 260;

const slide = (progress: Animated.Value, on: boolean) =>
  Animated.timing(progress, {
    toValue: on ? 1 : 0,
    duration: DURATION_MS,
    easing: Easing.inOut(Easing.cubic),
    // Colors can't use the native driver; the whole animation runs on JS so thumb and track stay in step.
    useNativeDriver: false,
  }).start();

// A label with our own switch; the whole row toggles. The platform switch jumps between colors; this one slides the
// thumb and fades the track. The animation starts on touch, before the screen re-renders with the new value, so a
// heavy form can't make it stutter.
export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  // Created once and kept for the component's life.
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  // Follows changes that don't come from a touch here (e.g. the form being reset).
  useEffect(() => {
    slide(progress, value);
  }, [value, progress]);

  const toggle = () => {
    slide(progress, !value);
    onChange(!value);
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}
    >
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Animated.View
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          justifyContent: "center",
          paddingHorizontal: 3,
          backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [colors.selected, colors.accent] }),
        }}
      >
        <Animated.View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.onAccent] }),
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
