import { useRef, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import type { Period } from "@/api/types";
import { bucketPeak, type Bucket, type ChartMode } from "@/data/chartBuckets";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
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
// Scale is worked out only once scrolling has stopped (spec 6), so the bars don't jump while the list moves.
const SETTLE_MS = 160;

const format = (date: string, lang: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(lang, options).format(parseLocalDate(date));
  } catch {
    return date;
  }
};

// Two short lines under a bar: "Jul" | "2 Nov" | "6" + "Fri"; years show only their number.
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

// Spec 6: bars for every period of the chosen size, scrolled sideways, newest on the right. The tallest bar among
// the visible periods fills the height. A tap on a bar selects it (the screen shows that period below) and shows
// its sum on a small plate.
export function BarChart({
  buckets,
  granularity,
  mode,
  colorOf,
  selection,
  onSelect,
}: {
  buckets: Bucket[];
  granularity: Period;
  mode: ChartMode;
  // Stacks in the expense / income view: the category's or tag's color.
  colorOf: (id: string) => string;
  selection: BarSelection | null;
  onSelect: (selection: BarSelection | null) => void;
}) {
  const { colors } = useTheme();
  const { lang } = useI18n();
  const { money, baseCurrency } = useMoney();
  const { width: windowWidth } = useWindowDimensions();
  const itemWidth = ITEM_WIDTH[mode === "general" ? "general" : "stacked"];
  const [viewport, setViewport] = useState(windowWidth - spacing.md * 4);
  // Starts at the end: the newest periods.
  const endX = Math.max(0, buckets.length * itemWidth - viewport);
  const scrollX = useRef(endX);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleRange = (x: number, width: number) => {
    const first = Math.max(0, Math.floor(x / itemWidth));
    const last = Math.min(buckets.length - 1, Math.ceil((x + width) / itemWidth));
    return [first, last] as const;
  };
  const peakOf = (x: number, width: number) => {
    const [first, last] = visibleRange(x, width);
    let peak = 0;
    for (let i = first; i <= last; i++) peak = Math.max(peak, bucketPeak(buckets[i], mode));
    return peak;
  };
  const yearsOf = (x: number, width: number) => {
    const [first, last] = visibleRange(x, width);
    const from = buckets[first]?.range.start.slice(0, 4) ?? "";
    const to = buckets[last]?.range.start.slice(0, 4) ?? "";
    return from === to ? from : `${from} – ${to}`;
  };

  // Where the list last came to rest; the scale and the years follow it (and new data) but not the moving list.
  const [restX, setRestX] = useState(endX);
  const scale = { peak: peakOf(restX, viewport), years: yearsOf(restX, viewport) };
  // The plate follows the bar it belongs to only until the list moves.
  const [plate, setPlate] = useState<{ x: number; y: number; text: string } | null>(null);

  const settle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setRestX(scrollX.current), SETTLE_MS);
  };

  const heightOf = (value: number) => (scale.peak > 0 ? Math.max(value > 0 ? 2 : 0, (value / scale.peak) * BAR_AREA) : 0);

  const select = (index: number, part: BarPart, barCenter: number, value: number) => {
    const bar = heightOf(Math.abs(value));
    setPlate({ x: index * itemWidth - scrollX.current + barCenter, y: BAR_AREA - bar - 34, text: money(value, baseCurrency, true) });
    onSelect({ index, part });
  };

  const dim = (index: number, part?: BarPart) =>
    selection && (selection.index !== index || (part && selection.part !== part)) ? 0.45 : 1;

  const renderItem = ({ item, index }: { item: Bucket; index: number }) => {
    const [line1, line2] = labels(item.range.start, granularity, lang);
    let bars;
    if (mode === "general") {
      const diff = item.income - item.expense;
      const parts: { part: BarPart; value: number; color: string }[] = [
        { part: "income", value: item.income, color: CHART_COLORS.income },
        { part: "expense", value: item.expense, color: CHART_COLORS.expense },
        { part: "diff", value: diff, color: diff >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss },
      ];
      const gap = (itemWidth - GENERAL_BAR * 3) / 4;
      bars = parts.map(({ part, value, color }, position) => (
        <Pressable
          key={part}
          onPress={() => select(index, part, gap + position * (GENERAL_BAR + gap) + GENERAL_BAR / 2, value)}
          hitSlop={{ top: BAR_AREA, left: 2, right: 2 }}
          style={{ width: GENERAL_BAR, height: heightOf(Math.abs(value)), backgroundColor: color, opacity: dim(index, part), borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
        />
      ));
    } else {
      const total = mode === "income" ? item.income : item.expense;
      bars = (
        <Pressable
          onPress={() => select(index, mode, itemWidth / 2, total)}
          hitSlop={{ top: BAR_AREA }}
          style={{ width: STACKED_BAR, height: heightOf(total), opacity: dim(index), overflow: "hidden", borderTopLeftRadius: 3, borderTopRightRadius: 3, flexDirection: "column-reverse" }}
        >
          {item.stacks.map((stack) => (
            <View key={stack.id} style={{ flex: stack.value, backgroundColor: colorOf(stack.id), borderTopWidth: 1, borderTopColor: colors.surface }} />
          ))}
        </Pressable>
      );
    }
    return (
      <View style={{ width: itemWidth }}>
        <View style={{ height: BAR_AREA, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly" }}>{bars}</View>
        <View style={{ height: 1, backgroundColor: colors.textSecondary }} />
        <View style={{ height: LABEL_HEIGHT, alignItems: "center", paddingTop: 4 }}>
          <AppText variant="caption" color={selection?.index === index ? colors.text : colors.textSecondary} style={{ textTransform: "capitalize" }}>
            {line1}
          </AppText>
          {line2 ? (
            <AppText variant="caption" secondary style={{ fontSize: 11, textTransform: "capitalize" }}>
              {line2}
            </AppText>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View onLayout={(event) => setViewport(event.nativeEvent.layout.width)}>
      <FlatList
        data={buckets}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(bucket) => bucket.range.start}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
        initialScrollIndex={buckets.length > 0 ? buckets.length - 1 : undefined}
        initialNumToRender={Math.ceil(viewport / itemWidth) + 2}
        windowSize={5}
        extraData={[scale.peak, selection]}
        onScrollBeginDrag={() => setPlate(null)}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x;
          settle();
        }}
        scrollEventThrottle={32}
      />
      {plate && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: Math.max(0, plate.y),
            left: Math.min(Math.max(0, plate.x - 60), viewport - 120),
            width: 120,
            alignItems: "center",
          }}
        >
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.text }}>
            <AppText variant="label" color={colors.background} numberOfLines={1}>
              {plate.text}
            </AppText>
          </View>
        </View>
      )}
      <AppText secondary style={{ textAlign: "center", marginTop: spacing.xs }}>
        {scale.years}
      </AppText>
    </View>
  );
}
