import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { Period } from "@/api/types";
import { bucketPeak, stackSum, type Bucket, type ChartMode } from "@/data/chartBuckets";
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
// Scale is worked out only once scrolling has stopped (spec 6), so the bars don't jump while the list moves; then
// they grow or shrink to the new scale.
const SETTLE_MS = 160;
const GROW_MS = 320;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A bar whose height follows the scale smoothly (on the UI thread).
function Bar({ height, onPress, style, children }: { height: number; onPress: () => void; style: StyleProp<ViewStyle>; children?: ReactNode }) {
  const animated = useSharedValue(height);
  useEffect(() => {
    animated.set(withTiming(height, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }));
  }, [height, animated]);
  const heightStyle = useAnimatedStyle(() => ({ height: animated.get() }));
  return (
    <AnimatedPressable onPress={onPress} hitSlop={{ top: BAR_AREA, left: 2, right: 2 }} style={[style, heightStyle]}>
      {children}
    </AnimatedPressable>
  );
}

const format = (date: string, lang: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(lang, options).format(parseLocalDate(date));
  } catch {
    return date;
  }
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

// Spec 6: bars for every period of the chosen size, scrolled sideways, today's on the right at first; empty periods
// before and after can be scrolled to as well. The tallest bar among those at least half on screen fills the height.
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

  // Today's bar is the last one fully on screen.
  const startIndex = Math.max(0, todayIndex + 1 - Math.floor(viewport / itemWidth));
  const startX = startIndex * itemWidth;
  const scrollX = useRef(startX);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the list last came to rest; the scale and the years follow it (and new data), not the moving list.
  const [restX, setRestX] = useState(startX);
  // The plate stays with its bar only until the list moves.
  const [plate, setPlate] = useState<{ x: number; y: number; text: string } | null>(null);

  // Bars at least half on screen.
  const first = Math.max(0, Math.ceil(restX / itemWidth - 0.5));
  const last = Math.min(buckets.length - 1, Math.floor((restX + viewport) / itemWidth - 0.5));
  let peak = 0;
  for (let i = first; i <= last; i++) peak = Math.max(peak, bucketPeak(buckets[i], mode));
  const fromYear = buckets[first]?.range.start.slice(0, 4) ?? "";
  const toYear = buckets[last]?.range.start.slice(0, 4) ?? "";
  const years = fromYear === toYear ? fromYear : `${fromYear} – ${toYear}`;

  const heightOf = (value: number) => (peak > 0 && value > 0 ? Math.min(BAR_AREA, Math.max(2, (value / peak) * BAR_AREA)) : 0);

  const settle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setRestX(scrollX.current), SETTLE_MS);
  };

  const select = (index: number, part: BarPart, barCenter: number, value: number) => {
    if (selection?.index === index && selection.part === part) {
      setPlate(null);
      onSelect(null);
      return;
    }
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
        <Bar
          key={part}
          height={heightOf(Math.abs(value))}
          onPress={() => select(index, part, gap + position * (GENERAL_BAR + gap) + GENERAL_BAR / 2, value)}
          style={{ width: GENERAL_BAR, backgroundColor: color, opacity: dim(index, part), borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
        />
      ));
    } else {
      const total = stackSum(item);
      bars = (
        <Bar
          height={heightOf(total)}
          onPress={() => select(index, mode, itemWidth / 2, total)}
          style={{
            width: STACKED_BAR,
            opacity: dim(index),
            overflow: "hidden",
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            flexDirection: "column-reverse",
          }}
        >
          {item.stacks.map((stack) => (
            <View key={stack.id} style={{ flex: stack.value, backgroundColor: colorOf(stack.id), borderTopWidth: 1, borderTopColor: colors.surface }} />
          ))}
        </Bar>
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
    <View>
      <FlatList
        data={buckets}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(bucket) => bucket.range.start}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
        initialScrollIndex={startIndex}
        initialNumToRender={Math.ceil(viewport / itemWidth) + 2}
        windowSize={5}
        extraData={[peak, selection]}
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
          style={{ position: "absolute", top: Math.max(0, plate.y), left: Math.min(Math.max(0, plate.x - 60), viewport - 120), width: 120, alignItems: "center" }}
        >
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.text }}>
            <AppText variant="label" color={colors.background} numberOfLines={1}>
              {plate.text}
            </AppText>
          </View>
        </View>
      )}
      <AppText secondary style={{ textAlign: "center", marginTop: spacing.xs }}>
        {years}
      </AppText>
    </View>
  );
}
