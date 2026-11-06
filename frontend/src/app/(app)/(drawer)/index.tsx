import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { FlatList, GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { router, useNavigation } from "expo-router";
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

// Finger travel that folds the chart (moving up) or, with the list at its top, opens it (pulling down further).
const FOLD_DRAG = 20;
const OPEN_DRAG = 40;
// Web: a mouse wheel has no finger, so there the list's own scroll position decides.
const WEB_COLLAPSE_AT = 24;
// Android reports the top of a list as 0.3 and the like, not exactly 0.
const TOP_TOLERANCE = 2;
// Tags are grey for now (no colors of their own); "no tag" has its own color. The icon and its part of the chart
// always use the same color.
const NO_TAG_COLOR = "#6D7FA3";
const TAG_ICON = "pound";
const NO_TAG_ICON = "tag-off-outline";

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
  const [collapsed, setCollapsedState] = useState(false);
  // The gesture's callbacks can outlive the render they were made in, so they read the latest value from here.
  const collapsedRef = useRef(false);
  const setCollapsed = (next: boolean) => {
    collapsedRef.current = next;
    setCollapsedState(next);
  };
  const listRef = useRef<FlatList<Group>>(null);
  const navigation = useNavigation();

  // Home always comes back with the chart open and the list at its top (spec 2.2).
  useEffect(
    () =>
      navigation.addListener("blur", () => {
        setCollapsed(false);
        // The list reports the new position (0) through onScroll.
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }),
    [navigation]
  );
  // Where the list is scrolled to, and the current drag: at most one fold or open per drag, and where the finger
  // was when the list reached its top (pulling past that point opens the chart).
  const scrollY = useRef(0);
  const drag = useRef({ changed: false, topAt: null as number | null, startedAt: 0, lastY: 0, scrolling: false });
  // When the list gets shorter (the chart folds, Categories -> Tags, another period) Android moves it back without a
  // scroll event, so the position is also corrected from the list's sizes.
  const sizes = useRef({ content: 0, layout: 0 });
  const clampScroll = () => {
    const max = Math.max(0, sizes.current.content - sizes.current.layout);
    if (scrollY.current > max) scrollY.current = max;
  };
  const toTop = () => {
    scrollY.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  // The finger's drag and the list's own scrolling both start a gesture; whichever comes second must not reset it.
  const startDrag = () => {
    const now = Date.now();
    if (now - drag.current.startedAt < 400) return;
    drag.current = { ...drag.current, changed: false, topAt: scrollY.current <= TOP_TOLERANCE ? 0 : null, startedAt: now };
  };

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

  // Spec 2.2, 2.8. The finger is watched next to the list's own scrolling, so it works the same with one row or a
  // hundred: moving it up folds the chart; once the list is at its very top, pulling further down opens it.
  const pan = usePanGesture({
    runOnJS: true,
    // A drag over a row must not also count as a tap on it.
    cancelsJSResponder: true,
    activeOffsetY: [-8, 8],
    failOffsetX: [-24, 24],
    onActivate: (event) => {
      // Already at the top when the finger went down: the pull counts from there.
      startDrag();
      follow(event.translationY);
    },
    onUpdate: (event) => follow(event.translationY),
  });

  function follow(dy: number) {
    const current = drag.current;
    if (current.changed) return;
    if (!collapsedRef.current) {
      if (dy < -FOLD_DRAG) {
        current.changed = true;
        setCollapsed(true);
      }
      return;
    }
    if (scrollY.current > TOP_TOLERANCE) {
      current.topAt = null;
      return;
    }
    current.topAt ??= dy;
    if (dy - current.topAt > OPEN_DRAG) {
      current.changed = true;
      setCollapsed(false);
    }
  }

  // The list's own scrolling, for long lists: scrolled down far enough folds the chart, and coming back to the very
  // top under the user's finger opens it (the drag above covers lists that don't scroll).
  const onListScroll = (y: number) => {
    const current = drag.current;
    const movingUp = y < current.lastY;
    current.lastY = y;
    scrollY.current = y;
    if (Platform.OS === "web") {
      if (y > WEB_COLLAPSE_AT && !collapsedRef.current) setCollapsed(true);
      else if (y <= TOP_TOLERANCE && collapsedRef.current) setCollapsed(false);
      return;
    }
    if (!current.scrolling || current.changed) return;
    if (y > WEB_COLLAPSE_AT && !collapsedRef.current) {
      current.changed = true;
      setCollapsed(true);
    } else if (movingUp && y <= TOP_TOLERANCE && collapsedRef.current) {
      current.changed = true;
      setCollapsed(false);
    }
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
              toTop();
            }}
          />
        </View>
      </ScreenHeader>

      <View style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, paddingBottom: spacing.md }}>
          <PeriodSwitcher
            value={range}
            onChange={(next) => {
              setRange(next);
              toTop();
            }} onSwipeVertical={(direction) => setCollapsed(direction === "up")}>
            <Pressable onPress={() => setCollapsed(false)} disabled={!collapsed} accessibilityRole={collapsed ? "button" : undefined}>
              <PeriodChart segments={segments} label={money(total, baseCurrency)} collapsed={collapsed} />
            </Pressable>
          </PeriodSwitcher>
          {/* Categories / tags: one small button in the free corner, showing the other view; a tap switches. */}
          <View style={{ position: "absolute", left: spacing.md, bottom: spacing.md }}>
            <IconButton
              icon={by === "category" ? TAG_ICON : "shape-outline"}
              label={t(by === "category" ? "home.byTags" : "home.byCategories")}
              size={40}
              onPress={() => {
                setBy(by === "category" ? "tag" : "category");
                setExpanded(new Set());
                toTop();
              }}
            />
          </View>
          <Fab placement="corner" label={t("entry.addTitle")} onPress={() => openNewTransaction(type)} size={52} />
        </View>
      </View>

      <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={groups}
        simultaneousWith={pan}
        keyExtractor={(group) => group.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <AppText secondary style={{ textAlign: "center", paddingVertical: spacing.xl }}>
            {t("home.empty")}
          </AppText>
        }
        onScroll={(event) => onListScroll(event.nativeEvent.contentOffset.y)}
        onScrollBeginDrag={(event) => {
          startDrag();
          drag.current.scrolling = true;
          drag.current.lastY = event.nativeEvent.contentOffset.y;
        }}
        onScrollEndDrag={() => {
          drag.current.scrolling = false;
        }}
        onContentSizeChange={(_, height) => {
          sizes.current.content = height;
          clampScroll();
        }}
        onLayout={(event) => {
          sizes.current.layout = event.nativeEvent.layout.height;
          clampScroll();
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
      </GestureDetector>
    </View>
  );
}
