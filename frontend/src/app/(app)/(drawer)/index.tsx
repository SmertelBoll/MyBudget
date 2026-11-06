import { useMemo, useRef, useState } from "react";
import { FlatList, LayoutAnimation, Platform, View } from "react-native";
import { router } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { QUICK_COLORS } from "@/constants/appearance";
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
const TAG_ICON = "pound";
const NO_TAG_ICON = "tag-off-outline";

// Opens the log with what Home shows now (spec 11).
export const logsParams = (type: EntryType, filter: AccountFilter, range: PeriodRange) => ({
  type,
  accounts: filter?.join(",") ?? "",
  kind: range.kind,
  start: range.start,
  end: range.end,
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
  const dragging = useRef(false);

  const entries = usePeriodEntries(type, filter, range);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const { total, groups } = useMemo(() => groupEntries(entries, by, new Set(tagById.keys())), [entries, by, tagById]);

  // Tags have no color of their own: they take the quick palette in order of size.
  const tagColor = (id: string, index: number) => (id === NO_TAG ? colors.iconIdle : QUICK_COLORS[index % QUICK_COLORS.length]);

  const look = (group: Group, index: number) => {
    if (by === "tag") {
      const tag = tagById.get(group.id);
      return { icon: tag ? TAG_ICON : NO_TAG_ICON, color: tagColor(group.id, index), title: tag?.name ?? t("home.noTag") };
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

  const segments = groups.map((group, index) => ({ id: group.id, value: group.amount, color: look(group, index).color }));

  const setCollapsedAnimated = (next: boolean) => {
    if (next === collapsed) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(next);
  };

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
        center={<AccountFilterSelect value={filter} onChange={setFilter} showBalance />}
        right={
          <IconButton
            icon="receipt-text-outline"
            label={t("logs.open")}
            onPress={() => router.push({ pathname: "/logs", params: logsParams(type, filter, range) })}
          />
        }
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <SegmentedSwitch
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
          <PeriodSwitcher value={range} onChange={setRange}>
            <PeriodChart segments={segments} label={money(total, baseCurrency)} collapsed={collapsed} />
          </PeriodSwitcher>
          <Fab placement="corner" label={t("entry.addTitle")} onPress={() => openNewTransaction(type)} size={collapsed ? 48 : 64} />
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(group) => group.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        ListHeaderComponent={
          <SegmentedSwitch
            options={[
              { value: "category", label: t("home.byCategories") },
              { value: "tag", label: t("home.byTags") },
            ]}
            value={by}
            onChange={(next) => {
              setBy(next);
              setExpanded(new Set());
            }}
          />
        }
        ListEmptyComponent={
          <AppText secondary style={{ textAlign: "center", paddingVertical: spacing.xl }}>
            {t("home.empty")}
          </AppText>
        }
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScrollEndDrag={() => {
          dragging.current = false;
        }}
        // Spec 2.2, 2.8: scrolling the list up shrinks the chart; it opens again once the list is back at the very
        // top by the user's own move (not when the list merely gets taller as the chart shrinks).
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          if (y > COLLAPSE_AT) setCollapsedAnimated(true);
          else if (y <= 0 && (dragging.current || Platform.OS === "web")) setCollapsedAnimated(false);
        }}
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
              limit={limitOf(item)}
            />
          );
        }}
      />
    </View>
  );
}
