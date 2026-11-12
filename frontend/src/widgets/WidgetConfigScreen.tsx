import { useEffect, useState } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import type { EntryType } from "@/api/types";
import { Reorderable } from "@/components/Reorderable";
import { readSelection, readSnapshot, TOTAL, writeSelection, type GroupKey, type Selection, type WidgetItem, type WidgetSnapshot } from "./snapshot";
import { WIDGET_NAMES, WidgetFor } from "./WidgetViews";

const BG = "#171717";
const ROW = "#2a2a2a";
const ROW_PRESSED = "#4a4a4a";
const TEXT = "#FAF8FF";
const MUTED = "#999999";
const ACCENT = "#F9F919";
const ON_ACCENT = "#0C1618";
const GOOD = "#66BB6A";
const BAD = "#EF5350";

const toneColor = (tone: WidgetItem["tone"]) => (tone === "good" ? GOOD : tone === "bad" ? BAD : TEXT);

// Opens when a widget is added (and from "Configure" on a placed one). It runs outside the app's screens, so it is
// plain and dark like the widgets, with words from the snapshot.
//
// On top, a small copy of the widget. Under it the chosen lines, numbered: hold and drag one to change the order (as
// with categories in the app), ✕ takes it off. Then the groups to choose from (totals, accounts, expenses, income,
// other), each opening with a tap; every line shows what it would show now, and a tap adds it at the end (or takes
// it off when already chosen). 4×2 also chooses what the categories on its right are. 2×1 shows one line: a tap on
// it is the whole setup.
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const single = widgetInfo.widgetName === WIDGET_NAMES.balance;
  const overview = widgetInfo.widgetName === WIDGET_NAMES.overview;
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null | undefined>(undefined);
  const [selection, setSelection] = useState<Selection>({ items: [TOTAL], side: "expense" });
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(new Set(["totals"]));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    readSnapshot().then(setSnapshot);
    readSelection(widgetInfo.widgetId).then(setSelection);
  }, [widgetInfo.widgetId]);

  const word = (key: string, fallback: string) => snapshot?.i18n[key] ?? fallback;
  const items = snapshot?.items ?? {};
  // Lines that no longer exist (a removed account) drop out.
  const picked = selection.items.filter((key) => items[key]);

  const finish = async (next: Selection) => {
    await writeSelection(widgetInfo.widgetId, next);
    renderWidget(
      <WidgetFor
        name={widgetInfo.widgetName}
        snapshot={snapshot ?? null}
        selection={next}
        width={widgetInfo.width}
        height={widgetInfo.height}
        fontScale={widgetInfo.screenInfo?.fontScale}
      />
    );
    setResult("ok");
  };

  const toggle = (key: string) => {
    if (single) {
      finish({ ...selection, items: [key] });
      return;
    }
    setSelection({ ...selection, items: picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key] });
  };
  const toggleGroup = (key: GroupKey) => {
    const next = new Set(openGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenGroups(next);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG, paddingTop: (StatusBar.currentHeight ?? 24) + 12 }}>
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}>
        {snapshot && !single ? <Preview items={picked.map((key) => items[key])} /> : null}

        <Text style={{ color: TEXT, fontSize: 22, fontWeight: "bold" }}>
          {single ? word("widget.chooseTitle", "What should the widget show?") : word("widget.chooseAccounts", "Lines on the widget")}
        </Text>
        <Text style={{ color: MUTED, fontSize: 14 }}>
          {snapshot === null
            ? word("widget.empty", "Open MyBudget and sign in first")
            : single
              ? word("widget.chooseHint", "Total counts the same accounts as on Home")
              : word("widget.orderHint", "The first one is big, the others smaller; as many show as fit the widget's height. Hold and drag to change the order")}
        </Text>

        {!single && picked.length ? <Heading text={word("widget.shown", "Shown, in this order")} /> : null}
        {!single ? (
          <Reorderable
            items={picked}
            keyOf={(key) => key}
            style={{ gap: 8 }}
            onDragChange={setDragging}
            onReorder={(keys) => setSelection({ ...selection, items: keys })}
            renderItem={(key, { dragging: lifted }) => {
              const item = items[key];
              const index = picked.indexOf(key);
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: lifted ? ROW_PRESSED : ROW,
                    borderWidth: lifted ? 1 : 0,
                    borderColor: ACCENT,
                  }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: index === 0 ? ACCENT : "#444", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: index === 0 ? ON_ACCENT : TEXT, fontWeight: "bold" }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: MUTED, fontSize: 12 }} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={{ color: toneColor(item.tone), fontSize: index === 0 ? 17 : 15, fontWeight: "bold" }} numberOfLines={1}>
                      {item.value}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggle(key)}
                    accessibilityRole="button"
                    accessibilityLabel={word("widget.remove", "Remove")}
                    hitSlop={4}
                    style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? ROW_PRESSED : "#3a3a3a" })}
                  >
                    <Text style={{ color: TEXT, fontSize: 14 }}>✕</Text>
                  </Pressable>
                  <Text style={{ color: MUTED, fontSize: 20, paddingHorizontal: 4 }}>≡</Text>
                </View>
              );
            }}
          />
        ) : null}

        {overview && snapshot ? (
          <>
            <Heading text={word("widget.side", "Categories on the right")} />
            <View style={{ flexDirection: "row", backgroundColor: ROW, borderRadius: 14, padding: 4, gap: 4 }}>
              {(["expense", "income"] as EntryType[]).map((side) => (
                <Pressable
                  key={side}
                  onPress={() => setSelection({ ...selection, side })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selection.side === side }}
                  style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: "center", backgroundColor: selection.side === side ? ACCENT : "transparent" }}
                >
                  <Text style={{ color: selection.side === side ? ON_ACCENT : TEXT, fontWeight: "bold" }}>
                    {word(side === "expense" ? "entries.expenses" : "entries.income", side === "expense" ? "Expenses" : "Income")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {snapshot?.groups.map((group) => {
          const isOpen = openGroups.has(group.key);
          const chosenHere = group.keys.filter((key) => picked.includes(key)).length;
          if (!group.keys.length) return null;
          return (
            <View key={group.key} style={{ marginTop: 6, borderRadius: 14, backgroundColor: "#202020", overflow: "hidden" }}>
              <Pressable
                onPress={() => toggleGroup(group.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: pressed ? ROW_PRESSED : "transparent" })}
              >
                <Text style={{ color: TEXT, fontSize: 17, fontWeight: "bold", flex: 1 }}>{group.title}</Text>
                {chosenHere ? (
                  <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: ON_ACCENT, fontWeight: "bold", fontSize: 13 }}>{chosenHere}</Text>
                  </View>
                ) : null}
                <Text style={{ color: MUTED, fontSize: 16 }}>{isOpen ? "▲" : "▼"}</Text>
              </Pressable>
              {isOpen
                ? group.keys.map((key) => {
                    const item = items[key];
                    const chosen = single ? picked[0] === key : picked.includes(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => toggle(key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen }}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderTopWidth: 1,
                          borderTopColor: "#2c2c2c",
                          backgroundColor: pressed ? ROW_PRESSED : "transparent",
                        })}
                      >
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: TEXT, fontSize: 15 }} numberOfLines={1}>
                            {item.label}
                          </Text>
                          <Text style={{ color: item.tone ? toneColor(item.tone) : MUTED, fontSize: 13 }} numberOfLines={1}>
                            {item.value}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: chosen ? ACCENT : "transparent",
                            borderWidth: chosen ? 0 : 1.5,
                            borderColor: MUTED,
                          }}
                        >
                          <Text style={{ color: chosen ? ON_ACCENT : MUTED, fontWeight: "bold", fontSize: 15 }}>{chosen ? "✓" : "+"}</Text>
                        </View>
                      </Pressable>
                    );
                  })
                : null}
            </View>
          );
        })}

        {!single ? (
          <Pressable
            onPress={() => finish({ ...selection, items: picked })}
            disabled={!picked.length}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 14,
              padding: 16,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: picked.length ? (pressed ? "#F2DB0B" : ACCENT) : "#444",
            })}
          >
            <Text style={{ color: picked.length ? ON_ACCENT : MUTED, fontSize: 16, fontWeight: "bold" }}>{word("widget.done", "Done")}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setResult("cancel")} accessibilityRole="button" style={{ padding: 14, alignItems: "center" }}>
          <Text style={{ color: MUTED, fontSize: 15 }}>{word("common.cancel", "Cancel")}</Text>
        </Pressable>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

function Heading({ text }: { text: string }) {
  return <Text style={{ color: MUTED, fontSize: 13, fontWeight: "bold", textTransform: "uppercase", marginTop: 12 }}>{text}</Text>;
}

// A small copy of the widget: the first line big, the rest smaller.
function Preview({ items }: { items: WidgetItem[] }) {
  const [first, ...rest] = items;
  return (
    <View style={{ alignSelf: "center", width: 220, padding: 16, borderRadius: 16, backgroundColor: "#0f0f0f", marginBottom: 8, borderWidth: 1, borderColor: "#333" }}>
      <Text style={{ color: MUTED, fontSize: 12 }} numberOfLines={1}>
        {first?.label ?? "—"}
      </Text>
      <Text style={{ color: first ? toneColor(first.tone) : MUTED, fontSize: 22, fontWeight: "bold" }} numberOfLines={1} adjustsFontSizeToFit>
        {first?.value ?? "—"}
      </Text>
      {rest.map((item) => (
        <View key={item.key} style={{ marginTop: 5 }}>
          <Text style={{ color: MUTED, fontSize: 10 }} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={{ color: toneColor(item.tone), fontSize: 13, fontWeight: "bold" }} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
