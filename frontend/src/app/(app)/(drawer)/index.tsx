import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { FlatList, GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useNavigation } from "expo-router";
import type { EntryType } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useCollection } from "@/data/hooks";
import { useTagTree } from "@/data/tags";
import { DEFAULT_INNER, groupEntries, usePeriodEntries, type AccountFilter, type Group } from "@/data/stats";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { entryDateFor, openNewTransaction } from "@/utils/navigation";
import { currentPeriod, type PeriodRange } from "@/utils/periods";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { useMoney } from "@/utils/useMoney";
import { AccountFilterSelect } from "@/components/AccountFilterSelect";
import { AppText } from "@/components/AppText";
import { Fab } from "@/components/Fab";
import { IconButton } from "@/components/IconButton";
import { InnerSwitch } from "@/components/InnerSwitch";
import { PeriodChart } from "@/components/PeriodChart";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SegmentedSwitch } from "@/components/SegmentedSwitch";
import { GroupRow, TAG_ICON, openLog, useGroupLook } from "@/components/GroupRow";

// Finger travel that folds the chart (moving up) or, with the list at its top, opens it (pulling down further).
const FOLD_DRAG = 20;
const OPEN_DRAG = 40;
// Web: a mouse wheel has no finger, so there the list's own scroll position decides.
const WEB_COLLAPSE_AT = 24;
// Android reports the top of a list as 0.3 and the like, not exactly 0.
const TOP_TOLERANCE = 2;
// Screen 2. Home: the chosen accounts' balance, Expenses / Income, a period with its chart, and the period's sums
// by category or by tag.
// Changing the Home account, the period or the focus in Settings starts Home over from them the next time it's
// opened (it stays mounted in the drawer, so its own choices would otherwise win).
export default function HomeScreen() {
  const { user } = useAuth();
  const settings = user?.settings;
  return <HomeContent key={[settings?.homeAccount, settings?.defaultPeriod, settings?.firstDayOfWeek, settings?.focus].join("|")} />;
}

function HomeContent() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { user } = useAuth();
  const bottomSpace = useBottomSpace();
  const settings = user?.settings;
  const accounts = useCollection("accounts");

  // Starting point from Settings (spec 13.1, 13.3): Home account, period and focus.
  const [type, setType] = useState<EntryType>(settings?.focus ?? "expense");
  const [filter, setFilter] = useState<AccountFilter>(() => {
    const home = settings?.homeAccount;
    return home && home !== "total" && accounts.some((account) => account.id === home && account.isActive) ? [home] : null;
  });
  const [range, setRange] = useState<PeriodRange>(() => currentPeriod(settings?.defaultPeriod ?? "week", settings?.firstDayOfWeek ?? 1));
  const [by, setBy] = useState<"category" | "tag">("category");
  // What rows open into, kept for each of the two views.
  const [innerFor, setInnerFor] = useState(DEFAULT_INNER);
  const inner = innerFor[by];
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
  // Spec 2.2, 2.8: moving the rows up folds the chart; back at the very top, moving them down further opens it.
  // Two sources, and only one of them for a given list:
  // - a list that scrolls: its own drag events. Android always sends them; a separate finger tracker would race the
  //   list's scrolling for the same touch and lose part of the time.
  // - a list that fits on screen doesn't scroll and sends nothing, so there the finger itself is followed.
  const scrollY = useRef(0);
  const sizes = useRef({ content: 0, layout: 0 });
  const canScroll = () => sizes.current.content > sizes.current.layout + 1;
  // A list that got shorter is moved back by Android without a scroll event: correct the position from the sizes.
  const clampScroll = () => {
    const max = Math.max(0, sizes.current.content - sizes.current.layout);
    if (scrollY.current > max) scrollY.current = max;
  };
  const toTop = () => {
    scrollY.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  // One drag of the list: where it started, how far down it went, and whether it already folded the chart.
  const listDrag = useRef({ active: false, startY: 0, maxY: 0, changed: false });
  // One drag of the finger over a list that doesn't scroll: at most one fold or open.
  const fingerDrag = useRef({ changed: false });

  const entries = usePeriodEntries(type, filter, range);
  const tagTree = useTagTree();
  const { total, groups } = useMemo(() => groupEntries(entries, by, tagTree, inner), [entries, by, tagTree, inner]);

  const { look } = useGroupLook(by);
  const segments = groups.map((group) => ({ id: group.id, value: group.amount, color: look(group.id).color }));

  const pan = usePanGesture({
    runOnJS: true,
    // A drag over a row must not also count as a tap on it.
    cancelsJSResponder: true,
    activeOffsetY: [-8, 8],
    failOffsetX: [-24, 24],
    onActivate: (event) => {
      fingerDrag.current.changed = false;
      followFinger(event.translationY);
    },
    onUpdate: (event) => followFinger(event.translationY),
  });

  // Only for a list that doesn't scroll (a scrolling one is handled by its own events below).
  function followFinger(dy: number) {
    if (canScroll() || fingerDrag.current.changed) return;
    if (!collapsedRef.current && dy < -FOLD_DRAG) {
      fingerDrag.current.changed = true;
      setCollapsed(true);
    } else if (collapsedRef.current && dy > OPEN_DRAG) {
      fingerDrag.current.changed = true;
      setCollapsed(false);
    }
  }

  const onListScroll = (y: number) => {
    scrollY.current = y;
    // Web: a mouse wheel has no drag events, so the position alone decides.
    if (Platform.OS === "web") {
      if (y > WEB_COLLAPSE_AT && !collapsedRef.current) setCollapsed(true);
      else if (y <= TOP_TOLERANCE && collapsedRef.current) setCollapsed(false);
      return;
    }
    const drag = listDrag.current;
    if (!drag.active) return;
    drag.maxY = Math.max(drag.maxY, y);
    if (!drag.changed && !collapsedRef.current && y - drag.startY > FOLD_DRAG) {
      drag.changed = true;
      setCollapsed(true);
    }
  };

  const onListDragStart = (y: number) => {
    listDrag.current = { active: true, startY: y, maxY: y, changed: false };
  };

  // Let go at the very top: the rows were either brought back up to it, or pulled down while already there (Android
  // shows that as overscroll, without scroll events). A fling that only coasts to the top doesn't count: pull again.
  const onListDragEnd = (y: number) => {
    const drag = listDrag.current;
    drag.active = false;
    const atTop = y <= TOP_TOLERANCE;
    const broughtUp = drag.startY > TOP_TOLERANCE;
    const pulledAtTop = drag.maxY <= TOP_TOLERANCE;
    if (!drag.changed && collapsedRef.current && atTop && (broughtUp || pulledAtTop)) setCollapsed(false);
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
        center={<AccountFilterSelect value={filter} onChange={setFilter} showBalance compact />}
        right={
          <IconButton
            icon="format-list-bulleted"
            label={t("logs.open")}
            onPress={() => openLog(type, filter, range)}
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
              <PeriodChart segments={segments} label={money(total, baseCurrency, "home")} collapsed={collapsed} />
            </Pressable>
          </PeriodSwitcher>
          {/* Categories / tags: a button in the free corner showing the current view; a tap switches to the other. Next
              to it a smaller one, the same way: what the rows open into. */}
          <View style={{ position: "absolute", left: spacing.md, bottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <IconButton
              icon={by === "category" ? "shape-outline" : TAG_ICON}
              label={t(by === "category" ? "home.byTags" : "home.byCategories")}
              size={40}
              onPress={() => {
                setBy(by === "category" ? "tag" : "category");
                setExpanded(new Set());
                toTop();
              }}
            />
            <InnerSwitch by={by} value={inner} onChange={(next) => setInnerFor((current) => ({ ...current, [by]: next }))} />
          </View>
          <Fab placement="corner" label={t("entry.addTitle")} onPress={() => openNewTransaction(type, entryDateFor(range))} size={52} />
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
        onScrollBeginDrag={(event) => onListDragStart(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => onListDragEnd(event.nativeEvent.contentOffset.y)}
        onContentSizeChange={(_, height) => {
          sizes.current.content = height;
          clampScroll();
        }}
        onLayout={(event) => {
          sizes.current.layout = event.nativeEvent.layout.height;
          clampScroll();
        }}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <GroupRow
            group={item}
            by={by}
            type={type}
            filter={filter}
            range={range}
            expanded={expanded.has(item.id)}
            onToggle={() => toggle(item.id)}
            moneyKind="home"
            inner={inner}
          />
        )}
      />
      </View>
      </GestureDetector>
    </View>
  );
}
