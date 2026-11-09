import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Canvas, Picture, Skia, createPicture, useFont } from "@shopify/react-native-skia";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import { Easing, cancelAnimation, useAnimatedReaction, useDerivedValue, useSharedValue, withDecay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { bucketPeak, stackSum } from "@/data/chartBuckets";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppText } from "../AppText";
import {
  BAR_AREA,
  CHART_COLORS,
  CHART_HEIGHT,
  GENERAL_BAR,
  STACKED_BAR,
  generalCenter,
  heightFor,
  hitBar,
  itemWidthFor,
  labels,
  partValue,
  spanText,
  type BarPart,
  type ChartProps,
} from "./chartShared";

const REGULAR = require("@expo-google-fonts/rubik/400Regular/Rubik_400Regular.ttf");
const GROW_MS = 320;
const DIM = 0.45;
const PARTS: BarPart[] = ["income", "expense", "diff"];

// Spec 6 on a Skia canvas: only the periods on screen are drawn, as rectangles and text on one picture, so a fling
// through years of days costs the same as a few weeks (no view per period, nothing for React to mount). Scrolling,
// its momentum and the scale animation run on the UI thread; JS hears only where the list came to rest, which
// periods are on screen (for the span below) and taps.
export default function BarCanvas({
  buckets,
  todayIndex,
  granularity,
  mode,
  colorOf,
  selection,
  onSelect,
  viewport,
}: ChartProps & { viewport: number }) {
  const { colors } = useTheme();
  const { lang } = useI18n();
  const { money, baseCurrency } = useMoney();
  const font = useFont(REGULAR, 12);
  const smallFont = useFont(REGULAR, 11);
  const itemWidth = itemWidthFor(mode);
  const count = buckets.length;
  const maxScroll = Math.max(0, count * itemWidth - viewport);
  // Today's bar is the last one fully on screen.
  const startX = Math.min(maxScroll, Math.max(0, (todayIndex + 1) * itemWidth - Math.floor(viewport / itemWidth) * itemWidth));

  const scrollX = useSharedValue(startX);
  // Read by the drawing: bumped once the canvas is on screen, as a picture made before that may never be shown.
  const redraw = useSharedValue(0);
  const dragFrom = useSharedValue(0);
  // Where the chart came to rest (the scale follows it, not the moving bars) and which periods are on screen.
  const [restX, setRestX] = useState(startX);
  const [firstShown, setFirstShown] = useState(Math.floor(startX / itemWidth));
  const [plate, setPlate] = useState<{ index: number; part: BarPart } | null>(null);

  // Bars at least half on screen set the scale.
  const first = Math.max(0, Math.ceil(restX / itemWidth - 0.5));
  const last = Math.min(count - 1, Math.floor((restX + viewport) / itemWidth - 0.5));
  let peak = 0;
  for (let i = first; i <= last; i++) peak = Math.max(peak, bucketPeak(buckets[i], mode));
  const peakShared = useSharedValue(peak);
  useEffect(() => {
    peakShared.set(withTiming(peak, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }));
  }, [peak, peakShared]);

  const selectedIndex = useSharedValue(selection?.index ?? -1);
  const selectedPart = useSharedValue<string>(selection?.part ?? "");
  useEffect(() => {
    selectedIndex.set(selection?.index ?? -1);
    selectedPart.set(selection?.part ?? "");
  }, [selection, selectedIndex, selectedPart]);

  // Plain arrays for the drawing worklet: values, stack colors, label texts and their widths.
  const data = useMemo(() => {
    const income: number[] = [];
    const expense: number[] = [];
    const totals: number[] = [];
    const stackFrom: number[] = [];
    const stackValues: number[] = [];
    const stackColors: string[] = [];
    const line1: string[] = [];
    const line2: string[] = [];
    for (const bucket of buckets) {
      income.push(bucket.income);
      expense.push(bucket.expense);
      totals.push(stackSum(bucket));
      stackFrom.push(stackValues.length);
      for (const stack of bucket.stacks) {
        stackValues.push(stack.value);
        stackColors.push(colorOf(stack.id));
      }
      const [a, b] = labels(bucket.range.start, granularity, lang);
      line1.push(a);
      line2.push(b);
    }
    stackFrom.push(stackValues.length);
    return { income, expense, totals, stackFrom, stackValues, stackColors, line1, line2 };
  }, [buckets, colorOf, granularity, lang]);
  const widths = useMemo(
    () => ({
      line1: font ? data.line1.map((text) => font.measureText(text).width) : [],
      line2: smallFont ? data.line2.map((text) => (text ? smallFont.measureText(text).width : 0)) : [],
    }),
    [data, font, smallFont]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => redraw.set(redraw.get() + 1));
    return () => cancelAnimationFrame(frame);
  }, [redraw, data, widths]);

  const general = mode === "general";
  const textColor = colors.text;
  const mutedColor = colors.textSecondary;
  const gapColor = colors.surface;

  const picture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        redraw.get();
        const x0 = scrollX.get();
        const top = peakShared.get();
        const chosen = selectedIndex.get();
        const chosenPart = selectedPart.get();
        const from = Math.max(0, Math.floor(x0 / itemWidth));
        const to = Math.min(count - 1, Math.ceil((x0 + viewport) / itemWidth));
        const paint = Skia.Paint();
        const barHeight = (value: number) => (top > 0 && value > 0 ? Math.max(2, (value / top) * BAR_AREA) : 0);

        // Bars, cut at the top of their area; a rounded top, the bottom on the axis.
        canvas.save();
        canvas.clipRect(Skia.XYWHRect(0, 0, viewport, BAR_AREA), 1, true);
        for (let i = from; i <= to; i++) {
          const left = i * itemWidth - x0;
          if (general) {
            const diff = data.income[i] - data.expense[i];
            const values = [data.income[i], data.expense[i], Math.abs(diff)];
            const fills = [CHART_COLORS.income, CHART_COLORS.expense, diff >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss];
            for (let p = 0; p < 3; p++) {
              const h = barHeight(values[p]);
              if (!h) continue;
              const dim = (chosen >= 0 && chosen !== i) || (chosen === i && chosenPart !== PARTS[p]);
              paint.setColor(Skia.Color(fills[p]));
              paint.setAlphaf(dim ? DIM : 1);
              const x = left + generalCenter(itemWidth, p) - GENERAL_BAR / 2;
              canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, BAR_AREA - h, GENERAL_BAR, h + 4), 3, 3), paint);
            }
          } else {
            const total = data.totals[i];
            const h = barHeight(total);
            if (!h) continue;
            const x = left + (itemWidth - STACKED_BAR) / 2;
            const alpha = chosen >= 0 && chosen !== i ? DIM : 1;
            canvas.save();
            canvas.clipRRect(Skia.RRectXY(Skia.XYWHRect(x, BAR_AREA - h, STACKED_BAR, h + 4), 3, 3), 1, true);
            // Biggest part at the bottom; a thin line of the card's color between parts.
            let y = BAR_AREA;
            for (let s = data.stackFrom[i]; s < data.stackFrom[i + 1]; s++) {
              const part = (data.stackValues[s] / total) * h;
              paint.setColor(Skia.Color(data.stackColors[s]));
              paint.setAlphaf(alpha);
              canvas.drawRect(Skia.XYWHRect(x, y - part, STACKED_BAR, part), paint);
              paint.setColor(Skia.Color(gapColor));
              paint.setAlphaf(1);
              canvas.drawRect(Skia.XYWHRect(x, y - part, STACKED_BAR, 1), paint);
              y -= part;
            }
            canvas.restore();
          }
        }
        canvas.restore();

        // The axis.
        paint.setColor(Skia.Color(mutedColor));
        paint.setAlphaf(1);
        canvas.drawRect(Skia.XYWHRect(0, BAR_AREA, viewport, 1), paint);

        // Two label lines under each period.
        if (font && smallFont) {
          for (let i = from; i <= to; i++) {
            const left = i * itemWidth - x0;
            paint.setColor(Skia.Color(chosen === i ? textColor : mutedColor));
            canvas.drawText(data.line1[i], left + (itemWidth - (widths.line1[i] ?? 0)) / 2, BAR_AREA + 18, paint, font);
            if (data.line2[i]) {
              paint.setColor(Skia.Color(mutedColor));
              canvas.drawText(data.line2[i], left + (itemWidth - (widths.line2[i] ?? 0)) / 2, BAR_AREA + 33, paint, smallFont);
            }
          }
        }
      },
      { width: viewport, height: CHART_HEIGHT }
    )
  );

  // The span below follows the scroll (only when the first period on screen changes).
  useAnimatedReaction(
    () => Math.floor(scrollX.get() / itemWidth),
    (now, before) => {
      if (now !== before) scheduleOnRN(setFirstShown, now);
    }
  );

  const pan = usePanGesture({
    // Sideways only: an up or down move scrolls the screen instead.
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    onBegin: () => {
      cancelAnimation(scrollX);
    },
    onActivate: () => {
      dragFrom.set(scrollX.get());
      scheduleOnRN(setPlate, null);
    },
    onUpdate: (event) => {
      scrollX.set(Math.min(maxScroll, Math.max(0, dragFrom.get() - event.translationX)));
    },
    onDeactivate: (event) => {
      scrollX.set(
        withDecay({ velocity: -event.velocityX, clamp: [0, maxScroll], deceleration: 0.997 }, (finished) => {
          if (finished) scheduleOnRN(setRestX, scrollX.get());
        })
      );
    },
  });

  // A tap selects the bar under the finger; the same bar again clears it.
  const tapAt = (x: number) => {
    const contentX = scrollX.get() + x;
    const index = Math.floor(contentX / itemWidth);
    const bucket = buckets[index];
    if (!bucket) return;
    const { part } = hitBar(bucket, mode, itemWidth, contentX - index * itemWidth);
    if (selection?.index === index && selection.part === part) {
      setPlate(null);
      onSelect(null);
      return;
    }
    setRestX(scrollX.get());
    setPlate({ index, part });
    onSelect({ index, part });
  };
  const tap = useTapGesture({
    onActivate: (event) => {
      scheduleOnRN(tapAt, event.x);
    },
  });
  const gestures = useCompetingGestures(pan, tap);

  // The sum above the chosen bar, while it belongs to the selection.
  const plateShown = plate && selection && plate.index === selection.index && plate.part === selection.part ? plate : null;
  const plateValue = plateShown ? partValue(buckets[plateShown.index], mode, plateShown.part) : 0;
  const plateX = plateShown
    ? plateShown.index * itemWidth - restX + (general ? generalCenter(itemWidth, PARTS.indexOf(plateShown.part)) : itemWidth / 2)
    : 0;
  const plateTop = BAR_AREA - heightFor(Math.abs(plateValue), peak) - 34;
  const span = spanText(buckets, firstShown, Math.min(count - 1, firstShown + Math.floor(viewport / itemWidth) - 1), granularity, lang);

  return (
    <View>
      <GestureDetector gesture={gestures}>
        <View>
          <Canvas style={{ width: viewport, height: CHART_HEIGHT }}>
            <Picture picture={picture} />
          </Canvas>
        </View>
      </GestureDetector>
      {plateShown && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: Math.max(0, plateTop), left: Math.min(Math.max(0, plateX - 60), viewport - 120), width: 120, alignItems: "center" }}
        >
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.text }}>
            <AppText variant="label" color={colors.background} numberOfLines={1}>
              {money(plateValue, baseCurrency, true)}
            </AppText>
          </View>
        </View>
      )}
      <AppText secondary style={{ textAlign: "center", marginTop: spacing.xs }}>
        {span}
      </AppText>
    </View>
  );
}
