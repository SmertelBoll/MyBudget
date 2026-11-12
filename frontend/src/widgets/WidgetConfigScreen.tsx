import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import { readSnapshot, readSelection, TOTAL, writeSelection, type WidgetSnapshot } from "./snapshot";
import { WidgetFor } from "./WidgetViews";

// Opens when a balance widget is added (and from "Configure" on a placed one): Total or one account. It runs
// outside the app's screens, so it is plain and dark like the widgets, with words from the snapshot.
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null | undefined>(undefined);
  const [current, setCurrent] = useState<string>(TOTAL);

  useEffect(() => {
    readSnapshot().then(setSnapshot);
    readSelection(widgetInfo.widgetId).then(setCurrent);
  }, [widgetInfo.widgetId]);

  const choose = async (key: string) => {
    await writeSelection(widgetInfo.widgetId, key);
    renderWidget(<WidgetFor name={widgetInfo.widgetName} snapshot={snapshot ?? null} selection={key} width={widgetInfo.width} height={widgetInfo.height} />);
    setResult("ok");
  };

  const word = (key: string, fallback: string) => snapshot?.i18n[key] ?? fallback;
  const scopes = snapshot ? [snapshot.total, ...snapshot.accounts] : [];

  return (
    <View style={{ flex: 1, backgroundColor: "#171717", paddingTop: (StatusBar.currentHeight ?? 24) + 16 }}>
      <Text style={{ color: "#FAF8FF", fontSize: 22, fontWeight: "bold", paddingHorizontal: 20 }}>{word("widget.chooseTitle", "What should the widget show?")}</Text>
      <Text style={{ color: "#999999", fontSize: 14, paddingHorizontal: 20, marginTop: 6 }}>
        {snapshot === null ? word("widget.empty", "Open MyBudget and sign in first") : word("widget.chooseHint", "Total counts the same accounts as Home")}
      </Text>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {scopes.map((scope) => (
          <Pressable
            key={scope.key}
            onPress={() => choose(scope.key)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 14,
              backgroundColor: pressed ? "#4a4a4a" : "#2a2a2a",
              borderWidth: scope.key === current ? 2 : 0,
              borderColor: "#F9F919",
            })}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: scope.color }} />
            <Text style={{ color: "#FAF8FF", fontSize: 16, flex: 1 }} numberOfLines={1}>
              {scope.name}
            </Text>
            <Text style={{ color: "#999999", fontSize: 15 }}>{scope.balance}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setResult("cancel")} accessibilityRole="button" style={{ padding: 16, alignItems: "center" }}>
          <Text style={{ color: "#999999", fontSize: 16 }}>{word("common.cancel", "Cancel")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
