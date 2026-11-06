import { useCallback, useEffect, useMemo, useState } from "react";
import { PanResponder, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatMonthTitle, monthGrid, parseLocalDate, todayLocal, weekdayNames } from "@/utils/dates";
import { AppText } from "./AppText";
import { FullScreenModal } from "./FullScreenModal";

const SWIPE_DISTANCE = 50;

// Month calendar with arrows and a sideways swipe between months (spec 4.5). Future dates are allowed.
export function CalendarModal({
  visible,
  value,
  title,
  onClose,
  onChange,
  onRangeChange,
}: {
  visible: boolean;
  // Range mode: the first tap is the start, the second the end; both and the days between are highlighted.
  // Defaults to "Choose a date"; e.g. "Start of the period" when picking a range.
  title?: string;
  value: string;
  onClose: () => void;
  onChange?: (date: string) => void;
  onRangeChange?: (start: string, end: string) => void;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const firstDay = user?.settings.firstDayOfWeek ?? 1;
  const today = todayLocal();

  const rangeMode = Boolean(onRangeChange);
  const [range, setRange] = useState<{ start: string; end: string | null } | null>(null);
  const done = Boolean(range?.end);

  // A short pause on the finished range so it's visible, then back to the screen.
  useEffect(() => {
    if (!range?.end) return;
    const timer = setTimeout(() => {
      onRangeChange?.(range.start, range.end!);
      onClose();
    }, 350);
    return () => clearTimeout(timer);
  }, [range, onRangeChange, onClose]);

  const pick = (date: string) => {
    if (!rangeMode) {
      onChange?.(date);
      onClose();
      return;
    }
    if (done) return;
    if (!range) setRange({ start: date, end: null });
    else setRange(date < range.start ? { start: date, end: range.start } : { start: range.start, end: date });
  };

  const initial = parseLocalDate(value);
  const [shown, setShown] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  // Only uses the state setter, so it never goes stale inside the gesture handler.
  const shift = useCallback(
    (delta: number) =>
      setShown(({ year, month }) => {
        const next = new Date(year, month + delta, 1, 12);
        return { year: next.getFullYear(), month: next.getMonth() };
      }),
    []
  );

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -SWIPE_DISTANCE) shift(1);
          else if (gesture.dx >= SWIPE_DISTANCE) shift(-1);
        },
      }),
    [shift]
  );

  const cells = monthGrid(shown.year, shown.month, firstDay);
  const weekdays = weekdayNames(lang, firstDay);

  return (
    <FullScreenModal visible={visible} title={rangeMode ? t(range ? "periods.pickEnd" : "periods.pickStart") : (title ?? t("dates.pick"))} onClose={onClose}>
      <View style={{ padding: spacing.md, gap: spacing.md }} {...swipe.panHandlers}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityLabel={t("dates.previousMonth")} style={{ padding: spacing.sm }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <AppText variant="heading" style={{ flex: 1, textAlign: "center", textTransform: "capitalize" }}>
            {formatMonthTitle(shown.year, shown.month, lang)}
          </AppText>
          <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityLabel={t("dates.nextMonth")} style={{ padding: spacing.sm }}>
            <MaterialCommunityIcons name="chevron-right" size={28} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row" }}>
          {weekdays.map((name) => (
            <AppText key={name} variant="caption" secondary style={{ width: `${100 / 7}%`, textAlign: "center" }}>
              {name}
            </AppText>
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((date, index) => {
            if (!date) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const edge = rangeMode ? date === range?.start || date === range?.end : date === value;
            const between = Boolean(rangeMode && range?.end && date > range.start && date < range.end);
            const selected = edge;
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                onPress={() => pick(date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
              >
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.md,
                    backgroundColor: selected ? colors.accent : between ? colors.accentMuted : "transparent",
                    borderWidth: isToday && !selected ? 1.5 : 0,
                    borderColor: colors.text,
                  }}
                >
                  <AppText color={selected ? colors.onAccent : between ? colors.onAccentMuted : colors.text}>{Number(date.slice(8))}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </FullScreenModal>
  );
}
