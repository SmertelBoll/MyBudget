"use no memo";
// Widgets are drawn by react-native-android-widget from these primitives only: no hooks, nothing async (the
// library's rules). Everything they show comes ready-made in the snapshot.
import type { EntryType } from "@/api/types";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { newEntryUri, type Selection, type Tone, type WidgetItem, type WidgetSnapshot } from "./snapshot";

export const WIDGET_NAMES = { balance: "Balance", summary: "Summary", overview: "Overview", quickAdd: "QuickAdd" } as const;

const BG = "#171717";
const TEXT = "#FAF8FF";
const MUTED = "#999999";
const ACCENT = "#F9F919";
const ON_ACCENT = "#0C1618";
const GOOD = "#66BB6A";
const BAD = "#EF5350";
const RADIUS = 16;

type Color = `#${string}`;
const hex = (color: string): Color => (/^#[0-9a-f]{6}$/i.test(color) ? (color as Color) : "#9E9E9E");
const toneColor = (tone: Tone): Color => (tone === "good" ? GOOD : tone === "bad" ? BAD : TEXT);

const open = (type?: EntryType) => ({ clickAction: "OPEN_URI", clickActionData: { uri: newEntryUri(type) } });

// The plain dark card every widget sits on; a tap anywhere opens a new entry.
function Card({ children, padding = 12 }: { children?: unknown; padding?: number }) {
  return (
    <FlexWidget
      {...open()}
      style={{ height: "match_parent", width: "match_parent", backgroundColor: BG, borderRadius: RADIUS, padding, flexDirection: "column", justifyContent: "center" }}
    >
      {children}
    </FlexWidget>
  );
}

function Message({ text }: { text: string }) {
  return (
    <Card>
      <TextWidget text={text} maxLines={3} style={{ color: MUTED, fontSize: 13, textAlign: "center", width: "match_parent" }} />
    </Card>
  );
}

const word = (snapshot: WidgetSnapshot, key: string, fallback: string) => snapshot.i18n[key] ?? fallback;

function Square({ text, type }: { text: string; type: EntryType }) {
  return (
    <FlexWidget
      {...open(type)}
      style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", marginLeft: 8 }}
    >
      <TextWidget text={text} style={{ color: ON_ACCENT, fontSize: 26, fontWeight: "bold" }} />
    </FlexWidget>
  );
}

// 2×1: the first line, its value as big as the widget allows. Stretched to 3–4 cells wide, "−" and "+" appear.
export function BalanceWidget({ item, width, height }: { item: WidgetItem; width: number; height: number }) {
  const buttons = width >= 200;
  const valueSize = Math.max(18, Math.min(44, height * 0.48));
  return (
    <Card padding={10}>
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "match_parent" }}>
          <TextWidget text={item.label} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 12 }} />
          <TextWidget text={item.value} maxLines={1} style={{ color: toneColor(item.tone), fontSize: valueSize, fontWeight: "bold", adjustsFontSizeToFit: true }} />
        </FlexWidget>
        {buttons ? <Square text="−" type="expense" /> : null}
        {buttons ? <Square text="+" type="income" /> : null}
      </FlexWidget>
    </Card>
  );
}

// Heights in dp, from Android's line height (about 1.17 × the font size) at the default font size; the user's font
// scale multiplies them. A home-screen cell is roughly 90 dp tall, though launchers differ (two cells: ~150–190 dp).
const PAD = 12;
const LINE = 1.17;
const CELL_DP = 90;
const NEXT_ROW = 6 + (11 + 16) * LINE; // gap, label, smaller value
const CATEGORY_ROW = 4 + 12 * LINE + 6; // margins, name and amount, bar

const cellsTall = (height: number) => Math.max(1, Math.round((height + 16) / CELL_DP));

// How many lines fit whole: the first one, then as many smaller lines as fit completely under it (three at two
// cells tall). A line is shown whole or not at all.
export const linesThatFit = (height: number, firstValue: number, fontScale = 1) => {
  const room = height - PAD * 2 - (13 + firstValue) * LINE * fontScale;
  return Math.max(1, 1 + Math.floor(room / (NEXT_ROW * fontScale)));
};

// Category lines that fit whole on 4×2: five at two cells tall, three more per extra cell.
export const categoriesThatFit = (height: number, fontScale = 1) =>
  Math.max(1, Math.min(cellsTall(height) * 3 - 1, Math.floor((height - PAD * 2) / (CATEGORY_ROW * fontScale))));

// The first line big, the others the same smaller size under it.
function Lines({ items, firstValue }: { items: WidgetItem[]; firstValue: number }) {
  const [first, ...rest] = items;
  return (
    <FlexWidget style={{ flexDirection: "column", justifyContent: "center", width: "match_parent", height: "match_parent" }}>
      <TextWidget text={first.label} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 13 }} />
      <TextWidget text={first.value} maxLines={1} style={{ color: toneColor(first.tone), fontSize: firstValue, fontWeight: "bold", adjustsFontSizeToFit: true }} />
      {rest.map((item) => (
        <FlexWidget key={item.key} style={{ flexDirection: "column", marginTop: 6 }}>
          <TextWidget text={item.label} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 11 }} />
          <TextWidget text={item.value} maxLines={1} style={{ color: toneColor(item.tone), fontSize: 16, fontWeight: "bold", adjustsFontSizeToFit: true }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

const SUMMARY_VALUE = 28;
const OVERVIEW_VALUE = 26;

// 2×2 (and taller): the chosen lines that fit.
export function SummaryWidget({ items }: { items: WidgetItem[] }) {
  return (
    <Card padding={PAD}>
      <Lines items={items} firstValue={SUMMARY_VALUE} />
    </Card>
  );
}

// 4×2: the same on the left; on the right this month's biggest categories of expenses or income (the user's choice)
// with their share, as many as fit whole.
export function OverviewWidget({ items, snapshot, side, width, categories }: { items: WidgetItem[]; snapshot: WidgetSnapshot; side: EntryType; width: number; categories: number }) {
  const barMax = Math.max(40, width / 2 - 40);
  const top = snapshot.top[side].slice(0, categories);
  return (
    <Card padding={PAD}>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ flex: 1, height: "match_parent" }}>
          <Lines items={items} firstValue={OVERVIEW_VALUE} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "match_parent", marginLeft: 12 }}>
          {top.length ? (
            top.map((item) => (
              <FlexWidget key={item.name} style={{ flexDirection: "column", width: "match_parent", marginVertical: 2 }}>
                <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget text={item.name} maxLines={1} truncate="END" style={{ color: TEXT, fontSize: 12 }} />
                  </FlexWidget>
                  <TextWidget text={item.amount} maxLines={1} style={{ color: MUTED, fontSize: 12 }} />
                </FlexWidget>
                <FlexWidget style={{ height: 4, width: Math.max(4, Math.round(barMax * item.share)), borderRadius: 2, backgroundColor: hex(item.color), marginTop: 2 }} />
              </FlexWidget>
            ))
          ) : (
            <TextWidget text={word(snapshot, "widget.none", "Nothing yet")} style={{ color: MUTED, fontSize: 12 }} />
          )}
        </FlexWidget>
      </FlexWidget>
    </Card>
  );
}

// 1×1: one big "+" for a new entry, on a square as big as the cell's shorter side (cells are rarely square), centred
// on a clear background.
export function QuickAddWidget({ width, height }: { width: number; height: number }) {
  const side = Math.max(32, Math.floor(Math.min(width, height)));
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", justifyContent: "center", alignItems: "center" }}>
      <FlexWidget
        {...open()}
        style={{ width: side, height: side, backgroundColor: ACCENT, borderRadius: Math.round(side * 0.28), justifyContent: "center", alignItems: "center" }}
      >
        <TextWidget text="+" style={{ color: ON_ACCENT, fontSize: Math.round(side * 0.5), fontWeight: "bold" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

// Any widget by name, for its chosen lines and current size. Lines that are gone (a removed account) are skipped.
export function WidgetFor({ name, snapshot, selection, width, height, fontScale }: { name: string; snapshot: WidgetSnapshot | null; selection: Selection; width: number; height: number; fontScale?: number }) {
  if (name === WIDGET_NAMES.quickAdd) return <QuickAddWidget width={width} height={height} />;
  if (!snapshot) return <Message text="Open MyBudget to set up the widget" />;
  const items = selection.items.map((key) => snapshot.items[key]).filter((item): item is WidgetItem => Boolean(item));
  if (!items.length) return <Message text={word(snapshot, "widget.accountGone", "This account is gone. Hold the widget to choose another")} />;
  if (name === WIDGET_NAMES.summary) return <SummaryWidget items={items.slice(0, linesThatFit(height, SUMMARY_VALUE, fontScale))} />;
  if (name === WIDGET_NAMES.overview) {
    return (
      <OverviewWidget
        items={items.slice(0, linesThatFit(height, OVERVIEW_VALUE, fontScale))}
        snapshot={snapshot}
        side={selection.side}
        width={width}
        categories={categoriesThatFit(height, fontScale)}
      />
    );
  }
  return <BalanceWidget item={items[0]} width={width} height={height} />;
}
