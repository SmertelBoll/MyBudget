import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { EntryType, Period } from "@/api/types";
import { useChartBuckets, type ChartMode } from "@/data/chartBuckets";
import { useCollection } from "@/data/hooks";
import { groupEntries, usePeriodEntries, type AccountFilter } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { formatPeriod, type PeriodRange } from "@/utils/periods";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { AccountFilterSelect } from "@/components/AccountFilterSelect";
import { AppText } from "@/components/AppText";
import { BarChart, CHART_COLORS, type BarSelection } from "@/components/BarChart";
import { GroupRow, TAG_ICON, useGroupLook, type GroupBy } from "@/components/GroupRow";
import { IconButton } from "@/components/IconButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";

const GRANULARITIES: { value: Period; label: string }[] = [
  { value: "year", label: "charts.byYear" },
  { value: "month", label: "charts.byMonth" },
  { value: "week", label: "charts.byWeek" },
  { value: "day", label: "charts.byDay" },
];

// Nothing selected yet: the hooks below still need a range.
const NO_RANGE: PeriodRange = { kind: "day", start: "0000-00-00", end: "0000-00-00" };

function Legend() {
  const { t } = useI18n();
  const items = [
    { color: CHART_COLORS.income, label: "charts.income" },
    { color: CHART_COLORS.expense, label: "charts.expenses" },
    { color: CHART_COLORS.profit, label: "charts.profit" },
    { color: CHART_COLORS.loss, label: "charts.loss" },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.md, rowGap: spacing.xs }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
          <AppText variant="caption" secondary>
            {t(item.label)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// Screen 6. Bars for every year / month / week / day of all time for the chosen accounts (all of them at first).
// General: income, expenses and their difference side by side; Expenses / Income: one bar split by category or tag.
// A tapped bar shows its sum, and the same rows as Home for that period appear below (not for the difference).
export default function ChartsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const bottomSpace = useBottomSpace();
  const tags = useCollection("tags");

  const [mode, setMode] = useState<ChartMode>("general");
  const [granularity, setGranularity] = useState<Period>("month");
  const [by, setBy] = useState<GroupBy>("category");
  const [filter, setFilter] = useState<AccountFilter>(null);
  const [selection, setSelection] = useState<BarSelection | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { buckets, todayIndex } = useChartBuckets(filter, granularity, mode, by);
  const { look } = useGroupLook(by);

  // Any other view of the chart starts without a selection.
  const reset = () => {
    setSelection(null);
    setExpanded(new Set());
  };

  const selected = selection ? buckets[selection.index] : undefined;
  // General view: the income or expense bar decides what's listed; the difference shows only its sum.
  const listType: EntryType | null =
    !selected || !selection ? null : mode === "general" ? (selection.part === "diff" ? null : selection.part) : mode;
  const listBy: GroupBy = mode === "general" ? "category" : by;
  const range = selected?.range ?? NO_RANGE;
  const entries = usePeriodEntries(listType ?? "expense", filter, range);
  const knownTagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const { groups } = useMemo(() => groupEntries(listType ? entries : [], listBy, knownTagIds), [entries, listType, listBy, knownTagIds]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t("nav.charts")}
        right={
          <AccountFilterSelect
            iconOnly
            value={filter}
            onChange={(next) => {
              setFilter(next);
              reset();
            }}
          />
        }
      >
        <View style={{ paddingHorizontal: spacing.md }}>
          <SegmentedSwitch
            compact
            options={[
              { value: "general", label: t("charts.general") },
              { value: "expense", label: t("entries.expenses") },
              { value: "income", label: t("entries.income") },
            ]}
            value={mode}
            onChange={(next) => {
              setMode(next);
              reset();
            }}
          />
        </View>
      </ScreenHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm }}>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {GRANULARITIES.map((option) => {
              const active = option.value === granularity;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setGranularity(option.value);
                    reset();
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  hitSlop={4}
                  style={{ alignItems: "center", paddingVertical: spacing.xs, gap: 4 }}
                >
                  <AppText variant="label" color={active ? colors.text : colors.textSecondary}>
                    {t(option.label)}
                  </AppText>
                  <View style={{ height: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: active ? colors.mark : "transparent" }} />
                </Pressable>
              );
            })}
          </View>

          <BarChart
            // A new size, view or set of accounts starts again at the newest periods.
            key={`${granularity}-${mode}-${filter?.join(",") ?? "all"}`}
            buckets={buckets}
            todayIndex={todayIndex}
            granularity={granularity}
            mode={mode}
            colorOf={(id) => look(id).color}
            selection={selection}
            onSelect={(next) => {
              setSelection(next);
              setExpanded(new Set());
            }}
          />

          <View style={{ minHeight: 40, justifyContent: "center" }}>
            {mode === "general" ? (
              <Legend />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <IconButton
                  icon={by === "category" ? TAG_ICON : "shape-outline"}
                  label={t(by === "category" ? "home.byTags" : "home.byCategories")}
                  size={40}
                  onPress={() => {
                    // Same periods, other split: the chosen bar and the scroll position stay.
                    setBy(by === "category" ? "tag" : "category");
                    setExpanded(new Set());
                  }}
                />
                {by === "tag" && (
                  // Android's balanced line breaking splits it into even lines in any language.
                  <AppText variant="caption" secondary textBreakStrategy="balanced" style={{ flex: 1, textAlign: "right" }}>
                    {t("charts.tagsDuplicated")}
                  </AppText>
                )}
              </View>
            )}
          </View>
        </View>

        {selected && listType ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading" style={{ marginTop: spacing.sm, textTransform: "capitalize" }}>
              {formatPeriod(selected.range, lang)}
            </AppText>
            {groups.length === 0 ? (
              <AppText secondary style={{ textAlign: "center", paddingVertical: spacing.lg }}>
                {t("home.empty")}
              </AppText>
            ) : (
              groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  by={listBy}
                  type={listType}
                  filter={filter}
                  range={selected.range}
                  expanded={expanded.has(group.id)}
                  onToggle={() => toggle(group.id)}
                />
              ))
            )}
          </View>
        ) : !selection ? (
          <AppText secondary style={{ textAlign: "center", paddingVertical: spacing.md }}>
            {t(buckets.some((bucket) => bucket.income || bucket.expense) ? "charts.hint" : "charts.empty")}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}
