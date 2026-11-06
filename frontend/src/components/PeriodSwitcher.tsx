import { useMemo, useState, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { PERIOD_KINDS, currentPeriod, formatPeriod, isLatestPeriod, shiftPeriod, type PeriodKind, type PeriodRange } from "@/utils/periods";
import { AppText } from "./AppText";
import { CalendarModal } from "./CalendarModal";

// A swipe counts when it travels far enough or is a quick flick (short but fast), as in system pagers.
const SWIPE_DISTANCE = 40;
const FLICK_DISTANCE = 12;
const FLICK_VELOCITY = 0.3;

const LABELS: Record<PeriodKind, string> = {
  day: "periods.day",
  week: "periods.week",
  month: "periods.month",
  year: "periods.year",
  custom: "periods.custom",
};

// Spec 2.8, 2.9: period tabs, arrows with the period's name, and a sideways swipe over `children` (the chart)
// to the previous / next period. "Period" asks for the first and the last day; tapping the name of a custom
// range asks again.
export function PeriodSwitcher({
  value,
  onChange,
  onSwipeVertical,
  children,
}: {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  // Home: an up / down swipe over the block folds / opens the chart.
  onSwipeVertical?: (direction: "up" | "down") => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const firstDay = user?.settings.firstDayOfWeek ?? 1;
  // Custom range: one calendar, first tap = start, second = end.
  const [picking, setPicking] = useState(false);

  const latest = isLatestPeriod(value);
  const step = (delta: -1 | 1) => {
    if (delta > 0 && latest) return;
    onChange(shiftPeriod(value, delta, firstDay));
  };

  // A clearly sideways move anywhere over the block (tabs, title, chart); vertical drags stay with the list. The
  // capture phase lets the gesture win over the chart's own touch handling.
  const swipe = useMemo(() => {
    const sideways = (dx: number, dy: number) => Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
    const upDown = (dx: number, dy: number) => Boolean(onSwipeVertical) && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5;
    const claim = (dx: number, dy: number) => sideways(dx, dy) || upDown(dx, dy);
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => claim(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponderCapture: (_, gesture) => claim(gesture.dx, gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
        if (Math.abs(dy) > Math.abs(dx)) {
          const flickY = Math.abs(dy) >= FLICK_DISTANCE && Math.abs(vy) >= FLICK_VELOCITY;
          if (flickY || Math.abs(dy) >= SWIPE_DISTANCE) onSwipeVertical?.(dy < 0 ? "up" : "down");
          return;
        }
        const flick = Math.abs(dx) >= FLICK_DISTANCE && Math.abs(vx) >= FLICK_VELOCITY;
        if (!flick && Math.abs(dx) < SWIPE_DISTANCE) return;
        if (dx < 0 && !isLatestPeriod(value)) onChange(shiftPeriod(value, 1, firstDay));
        else if (dx > 0) onChange(shiftPeriod(value, -1, firstDay));
      },
    });
  }, [value, onChange, firstDay, onSwipeVertical]);

  const pickKind = (kind: PeriodKind) => {
    if (kind === "custom") setPicking(true);
    else if (kind !== value.kind) {
      onChange(currentPeriod(kind, firstDay));
    }
  };

  return (
    // No text selection while dragging (web).
    <View style={{ gap: spacing.xs, userSelect: "none" }} {...swipe.panHandlers}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", justifyContent: "space-around" }}>
        {PERIOD_KINDS.map((kind) => {
          const active = kind === value.kind;
          return (
            <Pressable
              key={kind}
              onPress={() => pickKind(kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={4}
              style={{ alignItems: "center", paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, gap: 4 }}
            >
              <AppText variant="label" color={active ? colors.text : colors.textSecondary}>
                {t(LABELS[kind])}
              </AppText>
              <View style={{ height: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: active ? colors.mark : "transparent" }} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => step(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("periods.previous")} style={{ padding: spacing.sm }}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => value.kind === "custom" && pickKind("custom")}
          disabled={value.kind !== "custom"}
          style={{ flex: 1, alignItems: "center" }}
        >
          <AppText variant="heading" numberOfLines={1} style={{ textAlign: "center" }}>
            {formatPeriod(value, lang)}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => step(1)}
          disabled={latest}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("periods.next")}
          style={{ padding: spacing.sm, opacity: latest ? 0 : 1 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.text} />
        </Pressable>
      </View>

      {children}

      {picking && (
        <CalendarModal
          visible
          value={value.start}
          initialRange={value.kind === "custom" ? { start: value.start, end: value.end } : undefined}
          onRangeChange={(start, end) => onChange({ kind: "custom", start, end })}
          onClose={() => setPicking(false)}
        />
      )}
    </View>
  );
}
