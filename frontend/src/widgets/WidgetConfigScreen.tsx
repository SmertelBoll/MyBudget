import { useEffect, useState } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { Reorderable } from "@/components/Reorderable";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import { allScopes, readSnapshot, readSelection, TOTAL, writeSelection, type Selection, type WidgetScope, type WidgetSnapshot } from "./snapshot";
import { WIDGET_NAMES, WidgetFor } from "./WidgetViews";

const BG = "#171717";
const ROW = "#2a2a2a";
const ROW_PRESSED = "#4a4a4a";
const TEXT = "#FAF8FF";
const MUTED = "#999999";
const ACCENT = "#F9F919";
const ON_ACCENT = "#0C1618";

// Opens when a widget is added (and from "Configure" on a placed one). It runs outside the app's screens, so it is
// plain and dark like the widgets, with words from the snapshot.
// 2×1 shows one account: a tap on it is the whole setup. 2×2 and 4×2 show a list in the user's order: chosen accounts
// sit on top, numbered: hold and drag one to change the order (as with categories in the app), ✕ takes it off; the
// others below with "+"; a small copy of the widget on top shows the result.
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const multiple = widgetInfo.widgetName === WIDGET_NAMES.summary || widgetInfo.widgetName === WIDGET_NAMES.overview;
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null | undefined>(undefined);
  const [chosen, setChosen] = useState<Selection>([TOTAL]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    readSnapshot().then(setSnapshot);
    readSelection(widgetInfo.widgetId).then(setChosen);
  }, [widgetInfo.widgetId]);

  const word = (key: string, fallback: string) => snapshot?.i18n[key] ?? fallback;
  const scopes = snapshot ? allScopes(snapshot) : [];
  const byKey = new Map(scopes.map((scope) => [scope.key, scope]));
  // Accounts removed since the widget was set up drop out of the list.
  const picked = chosen.filter((key) => byKey.has(key));
  const others = scopes.filter((scope) => !picked.includes(scope.key));

  const finish = async (selection: Selection) => {
    await writeSelection(widgetInfo.widgetId, selection);
    renderWidget(
      <WidgetFor
        name={widgetInfo.widgetName}
        snapshot={snapshot ?? null}
        selection={selection}
        width={widgetInfo.width}
        height={widgetInfo.height}
        fontScale={widgetInfo.screenInfo?.fontScale}
      />
    );
    setResult("ok");
  };

  const header = (
    <>
      <Text style={{ color: TEXT, fontSize: 22, fontWeight: "bold" }}>
        {multiple ? word("widget.chooseAccounts", "Accounts on the widget") : word("widget.chooseTitle", "What should the widget show?")}
      </Text>
      <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
        {snapshot === null
          ? word("widget.empty", "Open MyBudget and sign in first")
          : multiple
            ? word("widget.orderHint", "The first one is big, the others smaller. How many show depends on the widget's height")
            : word("widget.chooseHint", "Total counts the same accounts as on Home")}
      </Text>
    </>
  );

  if (!multiple) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG, paddingTop: (StatusBar.currentHeight ?? 24) + 16 }}>
        <View style={{ paddingHorizontal: 20 }}>{header}</View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {scopes.map((scope) => (
            <Row key={scope.key} scope={scope} selected={scope.key === picked[0]} onPress={() => finish([scope.key])} />
          ))}
          <Pressable onPress={() => setResult("cancel")} accessibilityRole="button" style={{ padding: 14, alignItems: "center" }}>
            <Text style={{ color: MUTED, fontSize: 15 }}>{word("common.cancel", "Cancel")}</Text>
          </Pressable>
        </ScrollView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG, paddingTop: (StatusBar.currentHeight ?? 24) + 12 }}>
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}>
        {snapshot ? <Preview scopes={picked.map((key) => byKey.get(key)!)} monthLabel={snapshot.monthLabel} /> : null}
        {header}

        {picked.length ? <Section title={word("widget.shown", "Shown, in this order")} /> : null}
        <Reorderable
          items={picked}
          keyOf={(key) => key}
          style={{ gap: 8 }}
          onDragChange={setDragging}
          onReorder={setChosen}
          renderItem={(key, { dragging: lifted }) => {
            const scope = byKey.get(key)!;
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
                  <Text style={{ color: TEXT, fontSize: index === 0 ? 17 : 15, fontWeight: index === 0 ? "bold" : "normal" }} numberOfLines={1}>
                    {scope.name}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 13 }} numberOfLines={1}>
                    {scope.balance}
                  </Text>
                </View>
                <Small label={word("widget.remove", "Remove")} text="✕" onPress={() => setChosen(picked.filter((item) => item !== key))} />
                <Text style={{ color: MUTED, fontSize: 20, paddingHorizontal: 4 }} accessibilityElementsHidden>
                  ≡
                </Text>
              </View>
            );
          }}
        />

        {others.length ? <Section title={word("widget.add", "Add")} /> : null}
        {others.map((scope) => (
          <Row key={scope.key} scope={scope} plus selected={false} onPress={() => setChosen([...picked, scope.key])} />
        ))}

        <Pressable
          onPress={() => finish(picked)}
          disabled={!picked.length}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 12,
            padding: 16,
            borderRadius: 14,
            alignItems: "center",
            backgroundColor: picked.length ? (pressed ? "#F2DB0B" : ACCENT) : "#444",
          })}
        >
          <Text style={{ color: picked.length ? ON_ACCENT : MUTED, fontSize: 16, fontWeight: "bold" }}>{word("widget.done", "Done")}</Text>
        </Pressable>
        <Pressable onPress={() => setResult("cancel")} accessibilityRole="button" style={{ padding: 14, alignItems: "center" }}>
          <Text style={{ color: MUTED, fontSize: 15 }}>{word("common.cancel", "Cancel")}</Text>
        </Pressable>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={{ color: MUTED, fontSize: 13, fontWeight: "bold", textTransform: "uppercase", marginTop: 14, marginBottom: 2 }}>{title}</Text>;
}

function Small({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? ROW_PRESSED : "#3a3a3a" })}
    >
      <Text style={{ color: TEXT, fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
}

function Row({ scope, selected, plus, onPress }: { scope: WidgetScope; selected: boolean; plus?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 14,
        backgroundColor: pressed ? ROW_PRESSED : ROW,
        borderWidth: selected ? 2 : 0,
        borderColor: ACCENT,
      })}
    >
      {plus ? <Text style={{ color: ACCENT, fontSize: 20, fontWeight: "bold", width: 16 }}>+</Text> : <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: scope.color }} />}
      <Text style={{ color: TEXT, fontSize: 16, flex: 1 }} numberOfLines={1}>
        {scope.name}
      </Text>
      <Text style={{ color: MUTED, fontSize: 15 }}>{scope.balance}</Text>
    </Pressable>
  );
}

// A small copy of the widget: the first account big, the rest smaller, the month line.
function Preview({ scopes, monthLabel }: { scopes: WidgetScope[]; monthLabel: string }) {
  const [first, ...rest] = scopes;
  return (
    <View style={{ alignSelf: "center", width: 210, padding: 16, borderRadius: 16, backgroundColor: "#0f0f0f", marginBottom: 8, borderWidth: 1, borderColor: "#333" }}>
      <Text style={{ color: MUTED, fontSize: 12 }} numberOfLines={1}>
        {first?.name ?? "—"}
      </Text>
      <Text style={{ color: TEXT, fontSize: 22, fontWeight: "bold" }} numberOfLines={1} adjustsFontSizeToFit>
        {first?.balance ?? "—"}
      </Text>
      {rest.map((scope) => (
        <View key={scope.key} style={{ marginTop: 5 }}>
          <Text style={{ color: MUTED, fontSize: 10 }} numberOfLines={1}>
            {scope.name}
          </Text>
          <Text style={{ color: TEXT, fontSize: 13, fontWeight: "bold" }} numberOfLines={1}>
            {scope.balance}
          </Text>
        </View>
      ))}
      <Text style={{ color: MUTED, fontSize: 10, marginTop: 8 }} numberOfLines={1}>
        {monthLabel}
      </Text>
      <Text style={{ color: TEXT, fontSize: 13, fontWeight: "bold" }}>{first?.month ?? "—"}</Text>
    </View>
  );
}
