import { useMemo, useState, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { todayLocal } from "@/utils/dates";
import { PERIOD_KINDS, currentPeriod, formatPeriod, isLatestPeriod, shiftPeriod, type PeriodKind, type PeriodRange } from "@/utils/periods";
import { AppText } from "./AppText";
import { CalendarModal } from "./CalendarModal";

const SWIPE_DISTANCE = 50;

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
  children,
}: {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const firstDay = user?.settings.firstDayOfWeek ?? 1;
  // Custom range: which end is being picked, and the first day once chosen.
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [rangeStart, setRangeStart] = useState(todayLocal());

  const latest = isLatestPeriod(value);
  const step = (delta: -1 | 1) => {
    if (delta > 0 && latest) return;
    onChange(shiftPeriod(value, delta, firstDay));
  };

  // A clearly sideways move over the chart; vertical drags stay with the list.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -SWIPE_DISTANCE && !isLatestPeriod(value)) onChange(shiftPeriod(value, 1, firstDay));
          else if (gesture.dx >= SWIPE_DISTANCE) onChange(shiftPeriod(value, -1, firstDay));
        },
      }),
    [value, onChange, firstDay]
  );

  const pickKind = (kind: PeriodKind) => {
    if (kind === "custom") {
      setRangeStart(value.start);
      setPicking("start");
    } else if (kind !== value.kind) {
      onChange(currentPeriod(kind, firstDay));
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
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
              <View style={{ height: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: active ? colors.accent : "transparent" }} />
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

      {children ? <View {...swipe.panHandlers}>{children}</View> : null}

      {picking === "start" && (
        <CalendarModal
          key="start"
          visible
          title={t("periods.pickStart")}
          value={rangeStart}
          onChange={(date) => {
            setRangeStart(date);
            setPicking("end");
          }}
          // Closing after a pick moves on to the second step; closing without one cancels.
          onClose={() => setPicking((current) => (current === "start" ? null : current))}
        />
      )}
      {picking === "end" && (
        <CalendarModal
          key="end"
          visible
          title={t("periods.pickEnd")}
          value={rangeStart}
          onChange={(date) => {
            const [start, end] = date < rangeStart ? [date, rangeStart] : [rangeStart, date];
            onChange({ kind: "custom", start, end });
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </View>
  );
}
