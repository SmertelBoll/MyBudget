import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import type { Period } from "@/api/types";
import { bucketPeak, stackSum, type Bucket, type ChartMode } from "@/data/chartBuckets";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts, radius, spacing } from "@/theme/tokens";
import { parseLocalDate } from "@/utils/dates";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "./AppText";

export const CHART_COLORS = { income: "#4CAF82", expense: "#F5B731", profit: "#64B5F6", loss: "#FF8A65" };

export type BarPart = "income" | "expense" | "diff";
export type BarSelection = { index: number; part: BarPart };

const BAR_AREA = 200;
const LABEL_HEIGHT = 40;
const ITEM_WIDTH: Record<"general" | "stacked", number> = { general: 66, stacked: 52 };
const GENERAL_BAR = 14;
const STACKED_BAR = 30;
// Scale is worked out only once scrolling has stopped (spec 6), so the bars don't jump while the list moves; then
// they grow or shrink to the new scale.
const SETTLE_MS = 160;
const GROW_MS = 320;

// Bars are plain views sized in percent of their period's bar box. The box's height follows the chart's scale (one
// shared value for all periods) and animates on the UI thread: one animated view per period instead of one per bar,
// nothing drawn again in JS, and the bars stay rectangles standing on the axis. The box is "base" tall when the scale
// is what it was when the period appeared; bars that outgrow the area are cut at its top.
const share = (value: number, base: number) => (value > 0 ? `${(value / base) * 100}%` : 0) as `${number}%` | 0;

// selected: the chosen period's index (-1 = none); the other periods are dimmed here, so choosing a bar doesn't
// draw every period again.
function ScaledBars({
  base,
  peak,
  index,
  selected,
  children,
}: {
  base: number;
  peak: SharedValue<number>;
  index: number;
  selected: SharedValue<number>;
  children: ReactNode;
}) {
  const sized = useAnimatedStyle(() => {
    const top = peak.get();
    const chosen = selected.get();
    return { height: top > 0 ? (BAR_AREA * base) / top : BAR_AREA, opacity: chosen < 0 || chosen === index ? 1 : 0.45 };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly" }, sized]}
    >
      {children}
    </Animated.View>
  );
}

// Making an Intl formatter is slow on the phone's engine, and every bar needs one or two labels: one per language
// and format is made and kept.
const formatters = new Map<string, Intl.DateTimeFormat | null>();
const format = (date: string, lang: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${lang}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat(lang, options);
    } catch {
      formatter = null;
    }
    formatters.set(key, formatter);
  }
  return formatter ? formatter.format(parseLocalDate(date)) : date;
};

// Two short lines under a bar: "Jul" | "2" + "Nov" | "6" + "Fri"; years show only their number.
const labels = (start: string, granularity: Period, lang: string): [string, string] => {
  switch (granularity) {
    case "year":
      return [start.slice(0, 4), ""];
    case "month":
      return [format(start, lang, { month: "short" }), ""];
    case "week":
      return [format(start, lang, { day: "numeric" }), format(start, lang, { month: "short" })];
    case "day":
      return [format(start, lang, { day: "numeric" }), format(start, lang, { weekday: "short" })];
  }
};

const heightFor = (value: number, peak: number) => (peak > 0 && value > 0 ? Math.min(BAR_AREA, Math.max(2, (value / peak) * BAR_AREA)) : 0);

const generalParts = (bucket: Bucket) => {
  const diff = bucket.income - bucket.expense;
  return [
    { part: "income" as BarPart, value: bucket.income, color: CHART_COLORS.income },
    { part: "expense" as BarPart, value: bucket.expense, color: CHART_COLORS.expense },
    { part: "diff" as BarPart, value: diff, color: diff >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss },
  ];
};
const generalGap = (itemWidth: number) => (itemWidth - GENERAL_BAR * 3) / 4;
const generalCenter = (itemWidth: number, position: number) => {
  const gap = generalGap(itemWidth);
  return gap + position * (GENERAL_BAR + gap) + GENERAL_BAR / 2;
};

// The bar a tap at `x` (inside the period) means: in the general view the nearest of the three.
const hitBar = (bucket: Bucket, mode: ChartMode, itemWidth: number, x: number) => {
  if (mode !== "general") return { part: mode as BarPart, center: itemWidth / 2, value: stackSum(bucket) };
  const step = GENERAL_BAR + generalGap(itemWidth);
  const position = Math.max(0, Math.min(2, Math.round((x - generalCenter(itemWidth, 0)) / step)));
  const chosen = generalParts(bucket)[position];
  return { part: chosen.part, center: generalCenter(itemWidth, position), value: chosen.value };
};

// One period. Memoized: a tap redraws only the bars whose selection state changed, not the whole list.
// selectedPart: undefined = nothing is selected; "none" = another period is; otherwise this period's chosen bar.
const BarItem = memo(function BarItem({
  bucket,
  index,
  mode,
  granularity,
  itemWidth,
  peak,
  selectedPart,
  selectedIndex,
  colorOf,
}: {
  bucket: Bucket;
  index: number;
  mode: ChartMode;
  granularity: Period;
  itemWidth: number;
  peak: SharedValue<number>;
  // Only for the chosen period: which of its bars; its other bars are dimmed.
  selectedPart: BarPart | undefined;
  selectedIndex: SharedValue<number>;
  colorOf: (id: string) => string;
}) {
  const { colors } = useTheme();
  const { lang } = useI18n();
  const [line1, line2] = labels(bucket.range.start, granularity, lang);
  // The scale when this period was first drawn; later scales stretch it (see ScaledBars).
  const [base] = useState(() => peak.get() || 1);
  const opacity = (part: BarPart) => (selectedPart === undefined || selectedPart === part ? 1 : 0.45);

  let bars;
  if (mode === "general") {
    bars = generalParts(bucket).map(({ part, value, color }) => (
      <View
        key={part}
        style={{
          width: GENERAL_BAR,
          height: share(Math.abs(value), base),
          minHeight: value ? 2 : 0,
          backgroundColor: color,
          opacity: opacity(part),
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        }}
      />
    ));
  } else {
    const total = stackSum(bucket);
    bars = (
      <View
        style={{
          width: STACKED_BAR,
          height: share(total, base),
          minHeight: total ? 2 : 0,
          opacity: opacity(mode),
          overflow: "hidden",
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          flexDirection: "column-reverse",
        }}
      >
        {bucket.stacks.map((stack) => (
          <View key={stack.id} style={{ flex: stack.value, backgroundColor: colorOf(stack.id), borderTopWidth: 1, borderTopColor: colors.surface }} />
        ))}
      </View>
    );
  }
  const chosen = selectedPart !== undefined;
  // Fewer views per period: no touch area of its own (one for the whole chart), the axis is a border, and both label
  // lines are one text.
  return (
    <View style={{ width: itemWidth }}>
      <View style={{ height: BAR_AREA + 1, overflow: "hidden", borderBottomWidth: 1, borderBottomColor: colors.textSecondary }}>
        <ScaledBars base={base} peak={peak} index={index} selected={selectedIndex}>
          {bars}
        </ScaledBars>
      </View>
      <Text
        style={{
          height: LABEL_HEIGHT,
          paddingTop: 4,
          textAlign: "center",
          textTransform: "capitalize",
          fontFamily: fonts.regular,
          fontSize: fontSize.caption,
          color: chosen ? colors.text : colors.textSecondary,
        }}
      >
        {line1}
        {line2 ? <Text style={{ fontSize: 11, color: colors.textSecondary }}>{"\n" + line2}</Text> : null}
      </Text>
    </View>
  );
});

type Props = {
  buckets: Bucket[];
  todayIndex: number;
  granularity: Period;
  mode: ChartMode;
  // Stacks in the expense / income view: the category's or tag's color.
  colorOf: (id: string) => string;
  selection: BarSelection | null;
  onSelect: (selection: BarSelection | null) => void;
};

// Spec 6: bars for every period of the chosen size from the first entry, scrolled sideways, today's on the right at
// first. The tallest bar among those at least half on screen fills the height.
// A tap on a bar selects it (the screen shows that period below) and shows its sum; a second tap clears it.
export function BarChart(props: Props) {
  const [viewport, setViewport] = useState<number | null>(null);
  // Drawn once the real width is known, so it can open at today's period.
  return (
    <View onLayout={(event) => setViewport(event.nativeEvent.layout.width)}>
      {viewport === null ? <View style={{ height: BAR_AREA + 1 + LABEL_HEIGHT }} /> : <Bars {...props} viewport={viewport} />}
    </View>
  );
}

function Bars({ buckets, todayIndex, granularity, mode, colorOf, selection, onSelect, viewport }: Props & { viewport: number }) {
  const { colors } = useTheme();
  const { lang } = useI18n();
  const { money, baseCurrency } = useMoney();
  const itemWidth = ITEM_WIDTH[mode === "general" ? "general" : "stacked"];
  // Days fly by fastest when flung: many more of them are kept drawn on both sides.
  const byDay = granularity === "day";

  // Today's bar is the last one fully on screen.
  const startIndex = Math.max(0, todayIndex + 1 - Math.floor(viewport / itemWidth));
  const startX = startIndex * itemWidth;
  const scrollX = useRef(startX);
  // The list can't scroll past its end, so at first it may sit left of startX without telling (no scroll event):
  // the offset is kept within what the content allows.
  const contentWidth = useRef(Infinity);
  const offset = () => Math.min(scrollX.current, Math.max(0, contentWidth.current - viewport));
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the list last came to rest; the scale and the years follow it (and new data), not the moving list.
  const [restX, setRestX] = useState(startX);
  // The plate stays with its bar only until the list moves. Only where the bar was is kept: its height and sum are
  // read from the current data, so they stay right when the bars change (categories <-> tags, a new scale).
  const [plate, setPlate] = useState<{ x: number; index: number; part: BarPart } | null>(null);

  // Bars at least half on screen.
  const first = Math.max(0, Math.ceil(restX / itemWidth - 0.5));
  const last = Math.min(buckets.length - 1, Math.floor((restX + viewport) / itemWidth - 0.5));
  let peak = 0;
  for (let i = first; i <= last; i++) peak = Math.max(peak, bucketPeak(buckets[i], mode));
  // What the bars read; a new scale animates there instead of re-rendering every bar.
  const peakShared = useSharedValue(peak);
  useEffect(() => {
    peakShared.set(withTiming(peak, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }));
  }, [peak, peakShared]);
  // Under the chart: the years on screen; for days the months too ("October – November 2026"), as the bars only
  // carry day numbers.
  const firstStart = buckets[first]?.range.start ?? "";
  const lastStart = buckets[last]?.range.start ?? "";
  const span = (() => {
    if (!firstStart) return "";
    const [fromYear, toYear] = [firstStart.slice(0, 4), lastStart.slice(0, 4)];
    if (granularity !== "day") return fromYear === toYear ? fromYear : `${fromYear} – ${toYear}`;
    const month = (date: string) => format(date, lang, { month: "long" });
    const monthYear = (date: string) => format(date, lang, { month: "long", year: "numeric" });
    if (firstStart.slice(0, 7) === lastStart.slice(0, 7)) return monthYear(firstStart);
    return fromYear === toYear ? `${month(firstStart)} – ${monthYear(lastStart)}` : `${monthYear(firstStart)} – ${monthYear(lastStart)}`;
  })();

  const settle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setRestX(scrollX.current), SETTLE_MS);
  };

  // The chosen period, for dimming the others on the UI thread.
  const selectedIndex = useSharedValue(selection?.index ?? -1);
  useEffect(() => {
    selectedIndex.set(selection?.index ?? -1);
  }, [selection, selectedIndex]);

  // One tap area for the whole chart: the period under the finger from the scroll position, then its bar.
  const tapAt = (x: number) => {
    const contentX = offset() + x;
    const index = Math.floor(contentX / itemWidth);
    const bucket = buckets[index];
    if (!bucket) return;
    const hit = hitBar(bucket, mode, itemWidth, contentX - index * itemWidth);
    if (selection?.index === index && selection.part === hit.part) {
      setPlate(null);
      onSelect(null);
      return;
    }
    setPlate({ x: index * itemWidth - offset() + hit.center, index, part: hit.part });
    onSelect({ index, part: hit.part });
  };
  const tap = useTapGesture({ runOnJS: true, onActivate: (event) => tapAt(event.x) });

  // Shown only while it still belongs to the selected bar.
  const plateShown = plate && selection && plate.index === selection.index && plate.part === selection.part ? plate : null;
  const plateBucket = plateShown ? buckets[plateShown.index] : undefined;
  const plateValue = !plateBucket
    ? 0
    : mode !== "general"
      ? stackSum(plateBucket)
      : plateShown!.part === "income"
        ? plateBucket.income
        : plateShown!.part === "expense"
          ? plateBucket.expense
          : plateBucket.income - plateBucket.expense;
  const plateTop = BAR_AREA - heightFor(Math.abs(plateValue), peak) - 34;

  const renderItem = ({ item, index }: { item: Bucket; index: number }) => (
    <BarItem
      bucket={item}
      index={index}
      mode={mode}
      granularity={granularity}
      itemWidth={itemWidth}
      peak={peakShared}
      selectedPart={selection?.index === index ? selection.part : undefined}
      selectedIndex={selectedIndex}
      colorOf={colorOf}
    />
  );

  return (
    <View>
      <GestureDetector gesture={tap}>
      <View>
      <FlatList
        data={buckets}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(bucket) => bucket.range.start}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
        initialScrollIndex={startIndex}
        // Bars are cheap: keep plenty ready on both sides so a fast fling never shows empty space.
        initialNumToRender={Math.ceil(viewport / itemWidth) * (byDay ? 8 : 3)}
        maxToRenderPerBatch={byDay ? 60 : 30}
        updateCellsBatchingPeriod={16}
        windowSize={byDay ? 61 : 31}
        // Off-screen periods aren't drawn by the system while scrolling (Android).
        removeClippedSubviews
        extraData={selection}
        onContentSizeChange={(width) => {
          contentWidth.current = width;
          setRestX((current) => Math.min(current, Math.max(0, width - viewport)));
        }}
        onScrollBeginDrag={() => setPlate(null)}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x;
          settle();
        }}
        scrollEventThrottle={32}
      />
      </View>
      </GestureDetector>
      {plateShown && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: Math.max(0, plateTop), left: Math.min(Math.max(0, plateShown.x - 60), viewport - 120), width: 120, alignItems: "center" }}
        >
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.text }}>
            <AppText variant="label" color={colors.background} numberOfLines={1}>
              {money(plateValue, baseCurrency, true)}
            </AppText>
          </View>
        </View>
      )}
      <AppText secondary style={{ textAlign: "center", marginTop: spacing.xs, textTransform: "capitalize" }}>
        {span}
      </AppText>
    </View>
  );
}
