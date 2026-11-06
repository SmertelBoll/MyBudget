import { useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { categoryName } from "@/data/categories";
import { useCollection } from "@/data/hooks";
import { NO_TAG, groupEntries, usePeriodEntries, type AccountFilter, type Group } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { openNewTransaction } from "@/utils/navigation";
import { currentPeriod, type PeriodRange } from "@/utils/periods";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AccountFilterSelect } from "@/components/AccountFilterSelect";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { IconButton } from "@/components/IconButton";
import { PeriodChart } from "@/components/PeriodChart";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { StatsRow, type StatsChild } from "@/components/StatsRow";

const COLLAPSE_AT = 24;
// Tags are grey for now (no colors of their own); "no tag" has its own color. The icon and its part of the chart
// always use the same color.
const NO_TAG_COLOR = "#6D7FA3";
const TAG_ICON = "pound";
const NO_TAG_ICON = "tag-off-outline";
const BY_OPTIONS = [
  { value: "category", icon: "shape-outline", label: "home.byCategories" },
  { value: "tag", icon: "pound", label: "home.byTags" },
] as const;

// Opens the log with what Home shows now (spec 11), optionally narrowed to one category and / or tag.
export const logsParams = (
  type: EntryType,
  filter: AccountFilter,
  range: PeriodRange,
  only: { category?: string; tag?: string } = {}
) => ({
  type,
  accounts: filter?.join(",") ?? "",
  kind: range.kind,
  start: range.start,
  end: range.end,
  ...only,
});

// Screen 2. Home: the chosen accounts' balance, Expenses / Income, a period with its chart, and the period's sums
// by category or by tag.
export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { user } = useAuth();
  const bottomSpace = useBottomSpace();
  const settings = user?.settings;
  const categories = useCollection("categories");
  const tags = useCollection("tags");
  const accounts = useCollection("accounts");

  // Starting point from Settings (spec 13.1, 13.3): Home account, period and focus.
  const [type, setType] = useState<EntryType>(settings?.focus ?? "expense");
  const [filter, setFilter] = useState<AccountFilter>(() => {
    const home = settings?.homeAccount;
    return home && home !== "total" && accounts.some((account) => account.id === home && account.isActive) ? [home] : null;
  });
  const [range, setRange] = useState<PeriodRange>(() => currentPeriod(settings?.defaultPeriod ?? "week", settings?.firstDayOfWeek ?? 1));
  const [by, setBy] = useState<"category" | "tag">("category");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  // One fold or unfold per gesture: while the finger stays down the chart never flips back and forth. "pulled" =
  // the list was moved back towards its top by the user (not just shifted by the chart changing size).
  const gesture = useRef({ active: false, changed: false, pulled: false, lastY: 0 });

  const entries = usePeriodEntries(type, filter, range);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const { total, groups } = useMemo(() => groupEntries(entries, by, new Set(tagById.keys())), [entries, by, tagById]);

  const look = (group: Group, index: number) => {
    if (by === "tag") {
      const tag = tagById.get(group.id);
      return { icon: tag ? TAG_ICON : NO_TAG_ICON, color: tag ? colors.iconIdle : NO_TAG_COLOR, title: tag?.name ?? t("home.noTag") };
    }
    const category = categoryById.get(group.id);
    return {
      icon: category?.icon ?? "help",
      color: category?.color ?? colors.iconIdle,
      title: category ? categoryName(category, t) : "?",
    };
  };

  const breakdownOf = (group: Group): StatsChild[] => {
    if (by === "category") {
      // Only "no tag" inside: nothing to open.
      if (group.children.every((child) => child.id === NO_TAG)) return [];
      return group.children.map((child) => {
        const tag = tagById.get(child.id);
        return { id: child.id, icon: tag ? TAG_ICON : NO_TAG_ICON, title: tag?.name ?? t("home.noTag"), amount: money(child.amount, baseCurrency, true) };
      });
    }
    return group.children.map((child) => {
      const category = categoryById.get(child.id);
      return { id: child.id, icon: category?.icon ?? "help", title: category ? categoryName(category, t) : "?", amount: money(child.amount, baseCurrency, true) };
    });
  };

  const limitOf = (group: Group) => {
    if (by !== "category" || range.kind !== "month") return undefined;
    const planned = categoryById.get(group.id)?.plannedMonthly;
    if (!planned) return undefined;
    return {
      used: group.amount / planned,
      text: t("home.planned", { spent: money(group.amount, baseCurrency), planned: money(planned, baseCurrency) }),
    };
  };

  const segments = groups.map((group, index) => {
    return { id: group.id, value: group.amount, color: look(group, index).color };
  });

  const setChartCollapsed = (next: boolean) => {
    if (next === collapsed || gesture.current.changed) return;
    // Wheel / mouse scrolling on the web has no gestures to lock.
    if (Platform.OS !== "web") gesture.current.changed = true;
    setCollapsed(next);
  };

  // Spec 2.2, 2.8: scrolling the list up folds the chart into a bar; scrolling back to the very top opens it. With
  // few rows the list does not scroll at all: then a vertical swipe on the chart block (or a tap on the bar) does it.
  const onScrollY = (y: number) => {
    const current = gesture.current;
    if (y < current.lastY) current.pulled = true;
    current.lastY = y;
    if (y > COLLAPSE_AT) setChartCollapsed(true);
    else if (y <= 0 && current.pulled && (current.active || Platform.OS === "web")) setChartCollapsed(false);
  };
  // Let go at the top after pulling the list down (or a fling that stopped there): open the chart.
  const onScrollSettled = (y: number) => {
    const { changed, pulled } = gesture.current;
    gesture.current = { active: false, changed: false, pulled: false, lastY: y };
    if (!changed && pulled && y <= 0 && collapsed) setCollapsed(false);
  };

  const openLog = (only?: { category?: string; tag?: string }) =>
    router.push({ pathname: "/logs", params: logsParams(type, filter, range, only) });

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
        center={<AccountFilterSelect value={filter} onChange={setFilter} showBalance compact />}
        right={
          <IconButton
            icon="receipt-text-outline"
            label={t("logs.open")}
            onPress={() => openLog()}
          />
        }
      >
        <View style={{ paddingHorizontal: spacing.md }}>
          <SegmentedSwitch
            compact
            options={[
              { value: "expense", label: t("entries.expenses") },
              { value: "income", label: t("entries.income") },
            ]}
            value={type}
            onChange={(next) => {
              setType(next);
              setExpanded(new Set());
            }}
          />
        </View>
      </ScreenHeader>

      <View style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, paddingBottom: spacing.md }}>
          <PeriodSwitcher value={range} onChange={setRange} onSwipeVertical={(direction) => setCollapsed(direction === "up")}>
            <Pressable onPress={() => setCollapsed(false)} disabled={!collapsed} accessibilityRole={collapsed ? "button" : undefined}>
              <PeriodChart segments={segments} label={money(total, baseCurrency)} collapsed={collapsed} />
            </Pressable>
          </PeriodSwitcher>
          {/* Categories / tags: a small switch in the free corner, so the rows keep the room below. */}
          <View
            accessibilityRole="tablist"
            style={{
              position: "absolute",
              left: spacing.md,
              bottom: spacing.md,
              flexDirection: "row",
              padding: 3,
              borderRadius: radius.md,
              backgroundColor: colors.background,
            }}
          >
            {BY_OPTIONS.map((option) => {
              const active = option.value === by;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setBy(option.value);
                    setExpanded(new Set());
                  }}
                  accessibilityRole="tab"
                  accessibilityLabel={t(option.label)}
                  accessibilityState={{ selected: active }}
                  style={{
                    width: 38,
                    height: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.md - 3,
                    backgroundColor: active ? colors.accent : "transparent",
                  }}
                >
                  <MaterialCommunityIcons name={option.icon} size={18} color={active ? colors.onAccent : colors.text} />
                </Pressable>
              );
            })}
          </View>
          <Fab placement="corner" label={t("entry.addTitle")} onPress={() => openNewTransaction(type)} size={52} />
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(group) => group.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <AppText secondary style={{ textAlign: "center", paddingVertical: spacing.xl }}>
            {t("home.empty")}
          </AppText>
        }
        onScrollBeginDrag={(event) => {
          gesture.current = { active: true, changed: false, pulled: false, lastY: event.nativeEvent.contentOffset.y };
        }}
        onScrollEndDrag={(event) => {
          // A fling continues and ends in onMomentumScrollEnd; a plain release ends here.
          const velocity = event.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.05) onScrollSettled(event.nativeEvent.contentOffset.y);
        }}
        onMomentumScrollEnd={(event) => onScrollSettled(event.nativeEvent.contentOffset.y)}
        onScroll={(event) => onScrollY(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        renderItem={({ item, index }) => {
          const { icon, color, title } = look(item, index);
          return (
            <StatsRow
              icon={icon}
              color={color}
              title={title}
              share={item.share}
              amount={money(item.amount, baseCurrency)}
              breakdown={breakdownOf(item)}
              expanded={expanded.has(item.id)}
              onToggle={() => toggle(item.id)}
              onPress={() => openLog(by === "category" ? { category: item.id } : { tag: item.id })}
              onChildPress={(childId) =>
                openLog(by === "category" ? { category: item.id, tag: childId } : { tag: item.id, category: childId })
              }
              limit={limitOf(item)}
            />
          );
        }}
      />
    </View>
  );
}
