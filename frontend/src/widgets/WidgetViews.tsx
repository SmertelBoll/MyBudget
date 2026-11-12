"use no memo";
// Widgets are drawn by react-native-android-widget from these primitives only: no hooks, nothing async (the
// library's rules). Everything they show comes ready-made in the snapshot.
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { newEntryUri, type WidgetScope, type WidgetSnapshot } from "./snapshot";

export const WIDGET_NAMES = { balance: "Balance", summary: "Summary", overview: "Overview", quickAdd: "QuickAdd" } as const;

const BG = "#171717";
const TEXT = "#FAF8FF";
const MUTED = "#999999";
const ACCENT = "#F9F919";
const ON_ACCENT = "#0C1618";
const RADIUS = 16;

type Color = `#${string}`;
const hex = (color: string): Color => (/^#[0-9a-f]{6}$/i.test(color) ? (color as Color) : "#9E9E9E");

const open = (type?: "expense" | "income") => ({ clickAction: "OPEN_URI", clickActionData: { uri: newEntryUri(type) } });

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

const label = (snapshot: WidgetSnapshot, key: string, fallback: string) => snapshot.i18n[key] ?? fallback;

// The scope a widget shows, or why it can't: no data yet, or its account is gone.
export const scopeOf = (snapshot: WidgetSnapshot | null, key: string): WidgetScope | "empty" | "gone" => {
  if (!snapshot) return "empty";
  if (key === snapshot.total.key) return snapshot.total;
  return snapshot.accounts.find((scope) => scope.key === key) ?? "gone";
};

function Square({ text, type }: { text: string; type: "expense" | "income" }) {
  return (
    <FlexWidget
      {...open(type)}
      style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", marginLeft: 8 }}
    >
      <TextWidget text={text} style={{ color: ON_ACCENT, fontSize: 26, fontWeight: "bold" }} />
    </FlexWidget>
  );
}

// 2×1: the name small, the amount as big as the widget allows. Stretched to 3–4 cells wide, "−" and "+" appear.
export function BalanceWidget({ scope, width, height }: { scope: WidgetScope; width: number; height: number }) {
  const buttons = width >= 200;
  const amountSize = Math.max(18, Math.min(44, height * 0.48));
  return (
    <Card padding={10}>
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "match_parent" }}>
          <TextWidget text={scope.name} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 12 }} />
          <TextWidget text={scope.balance} maxLines={1} style={{ color: TEXT, fontSize: amountSize, fontWeight: "bold", adjustsFontSizeToFit: true }} />
        </FlexWidget>
        {buttons ? <Square text="−" type="expense" /> : null}
        {buttons ? <Square text="+" type="income" /> : null}
      </FlexWidget>
    </Card>
  );
}

// 2×2: balance and this month's spending.
export function SummaryWidget({ scope, snapshot }: { scope: WidgetScope; snapshot: WidgetSnapshot }) {
  return (
    <Card padding={14}>
      <TextWidget text={scope.name} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 13 }} />
      <TextWidget text={scope.balance} maxLines={1} style={{ color: TEXT, fontSize: 30, fontWeight: "bold", adjustsFontSizeToFit: true }} />
      <TextWidget text={label(snapshot, "widget.spentMonth", "Spent this month")} maxLines={1} style={{ color: MUTED, fontSize: 12, marginTop: 10 }} />
      <TextWidget text={scope.monthSpent} maxLines={1} style={{ color: TEXT, fontSize: 18, fontWeight: "bold", adjustsFontSizeToFit: true }} />
    </Card>
  );
}

// 4×2: balance and spending on the left, the month's five biggest categories with their share on the right.
export function OverviewWidget({ scope, snapshot, width }: { scope: WidgetScope; snapshot: WidgetSnapshot; width: number }) {
  const barMax = Math.max(40, width / 2 - 40);
  return (
    <Card padding={14}>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "match_parent" }}>
          <TextWidget text={scope.name} maxLines={1} truncate="END" style={{ color: MUTED, fontSize: 13 }} />
          <TextWidget text={scope.balance} maxLines={1} style={{ color: TEXT, fontSize: 28, fontWeight: "bold", adjustsFontSizeToFit: true }} />
          <TextWidget text={label(snapshot, "widget.spentMonth", "Spent this month")} maxLines={1} style={{ color: MUTED, fontSize: 12, marginTop: 8 }} />
          <TextWidget text={scope.monthSpent} maxLines={1} style={{ color: TEXT, fontSize: 17, fontWeight: "bold", adjustsFontSizeToFit: true }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: "column", justifyContent: "center", height: "match_parent", marginLeft: 12 }}>
          {scope.top.map((item) => (
            <FlexWidget key={item.name} style={{ flexDirection: "column", width: "match_parent", marginVertical: 2 }}>
              <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget text={item.name} maxLines={1} truncate="END" style={{ color: TEXT, fontSize: 12 }} />
                </FlexWidget>
                <TextWidget text={item.amount} maxLines={1} style={{ color: MUTED, fontSize: 12 }} />
              </FlexWidget>
              <FlexWidget style={{ height: 4, width: Math.max(4, Math.round(barMax * item.share)), borderRadius: 2, backgroundColor: hex(item.color), marginTop: 2 }} />
            </FlexWidget>
          ))}
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

// Any widget by name, for its chosen scope and current size.
export function WidgetFor({ name, snapshot, selection, width, height }: { name: string; snapshot: WidgetSnapshot | null; selection: string; width: number; height: number }) {
  if (name === WIDGET_NAMES.quickAdd) return <QuickAddWidget width={width} height={height} />;
  const scope = scopeOf(snapshot, selection);
  if (scope === "empty" || !snapshot) return <Message text="Open MyBudget to set up the widget" />;
  if (scope === "gone") return <Message text={label(snapshot, "widget.accountGone", "This account is gone. Hold the widget to choose another")} />;
  if (name === WIDGET_NAMES.summary) return <SummaryWidget scope={scope} snapshot={snapshot} />;
  if (name === WIDGET_NAMES.overview) return <OverviewWidget scope={scope} snapshot={snapshot} width={width} />;
  return <BalanceWidget scope={scope} width={width} height={height} />;
}
