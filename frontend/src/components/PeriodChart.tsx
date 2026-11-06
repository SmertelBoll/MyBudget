import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

export type ChartSegment = { id: string; value: number; color: string };

const SIZE = 220;
const STROKE = 46;
const GAP = 2;

// Spec 2.2: a ring of the period's categories (or tags) with the total in the middle; when the list below is
// scrolled up it shrinks to a thin bar of the same colors (screenshot 3).
export function PeriodChart({ segments, label, collapsed }: { segments: ChartSegment[]; label: string; collapsed: boolean }) {
  const { colors } = useTheme();
  const shown = segments.filter((segment) => segment.value > 0);
  const sum = shown.reduce((acc, segment) => acc + segment.value, 0);

  if (collapsed) {
    return (
      <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
        <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", backgroundColor: colors.selected, gap: shown.length > 1 ? GAP : 0 }}>
          {shown.map((segment) => (
            <View key={segment.id} style={{ flex: segment.value, backgroundColor: segment.color }} />
          ))}
        </View>
        <AppText variant="title" style={{ textAlign: "center" }}>
          {label}
        </AppText>
      </View>
    );
  }

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = shown.length > 1 ? GAP : 0;
  // Where each arc starts along the ring, and how long it is.
  const arcs = shown.map((segment, index) => {
    const start = shown.slice(0, index).reduce((acc, item) => acc + (item.value / sum) * circumference, 0);
    const length = (segment.value / sum) * circumference;
    return { segment, start, visible: Math.max(length - gap, 0.5) };
  });

  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: SIZE + spacing.md }}>
      {/* Turned so the first arc starts at 12 o'clock; the sums are read from the list below. */}
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
          {/* Dashed ring inside, as in the reference. */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius - STROKE / 2 - 10}
            stroke={colors.selected}
            strokeWidth={2}
            strokeDasharray="6 6"
            fill="none"
          />
        </G>
      </Svg>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: STROKE + spacing.lg }}>
        <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: "center" }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}
