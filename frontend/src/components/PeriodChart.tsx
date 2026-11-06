import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

export type ChartSegment = { id: string; value: number; color: string };

const SIZE = 220;
const STROKE = 46;
const GAP = 2;
const EXPANDED_HEIGHT = SIZE + spacing.md;
// Room for the bar above the "+" button that sits in the corner below it.
const COLLAPSED_HEIGHT = 74;
const DURATION = 260;

function Ring({ segments, sum }: { segments: ChartSegment[]; sum: number }) {
  const { colors } = useTheme();
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? GAP : 0;
  // Where each arc starts along the ring, and how long it is.
  const arcs = segments.map((segment, index) => {
    const start = segments.slice(0, index).reduce((acc, item) => acc + (item.value / sum) * circumference, 0);
    const length = (segment.value / sum) * circumference;
    return { segment, start, visible: Math.max(length - gap, 0.5) };
  });
  return (
    // Turned so the first arc starts at 12 o'clock; the sums are read from the list below.
    <View style={{ transform: [{ rotate: "-90deg" }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SIZE} height={SIZE}>
        <G>
          {/* Empty period: a plain ring. */}
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={colors.selected} strokeWidth={STROKE} fill="none" opacity={sum ? 0 : 1} />
          {arcs.map(({ segment, start, visible }) => (
            <Circle
              key={segment.id}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${visible} ${circumference - visible}`}
              strokeDashoffset={-start}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

// Spec 2.2: a ring of the period's categories (or tags) with the total in the middle; when the list below is
// scrolled up it shrinks to a thin bar of the same colors (screenshot 3). The change is animated on the UI thread:
// the block's height, the ring fading and shrinking, the bar fading in.
export function PeriodChart({ segments, label, collapsed }: { segments: ChartSegment[]; label: string; collapsed: boolean }) {
  const { colors } = useTheme();
  const shown = segments.filter((segment) => segment.value > 0);
  const sum = shown.reduce((acc, segment) => acc + segment.value, 0);
  const progress = useSharedValue(collapsed ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(collapsed ? 1 : 0, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
  }, [collapsed, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [EXPANDED_HEIGHT, COLLAPSED_HEIGHT]),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6], [1, 0], "clamp"),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 0.4]) }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.4, 1], [0, 1], "clamp"),
  }));

  return (
    <Animated.View style={[{ overflow: "hidden" }, boxStyle]}>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? "no-hide-descendants" : "auto"}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, height: EXPANDED_HEIGHT, alignItems: "center", justifyContent: "center" }, ringStyle]}
      >
        <Ring segments={shown} sum={sum} />
        <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: STROKE + spacing.lg }}>
          <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: "center" }}>
            {label}
          </AppText>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden={!collapsed}
        importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, gap: spacing.sm, paddingVertical: spacing.xs }, barStyle]}>
        <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", backgroundColor: colors.selected, gap: shown.length > 1 ? GAP : 0 }}>
          {shown.map((segment) => (
            <View key={segment.id} style={{ flex: segment.value, backgroundColor: segment.color }} />
          ))}
        </View>
        <AppText variant="title" style={{ textAlign: "center" }}>
          {label}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}
