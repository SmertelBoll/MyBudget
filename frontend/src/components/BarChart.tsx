import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "expo-router";
import { BarCanvasHost } from "./chart/BarCanvasHost";
import { CHART_HEIGHT, type ChartProps } from "./chart/chartShared";

export { CHART_COLORS, type BarPart, type BarSelection } from "./chart/chartShared";

// Spec 6: bars for every period of the chosen size from the first entry, scrolled sideways, today's on the right at
// first. The tallest bar among those at least half on screen fills the height. A tap on a bar selects it (the screen
// shows that period below) and shows its sum; a second tap clears it. Drawn on a canvas (chart/BarCanvas).
export function BarChart(props: ChartProps) {
  const [viewport, setViewport] = useState<number | null>(null);
  // A sideways swipe over the bars scrolls them; from the left edge it would also open the side menu. While a finger
  // is on the chart the menu's swipe is off (it still opens by swipe everywhere else on the screen).
  const navigation = useNavigation();
  const menuSwipe = (enabled: boolean) => navigation.setOptions({ swipeEnabled: enabled } as object);
  // Drawn once the real width is known, so it can open at today's period.
  return (
    <View
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
      onTouchStart={() => menuSwipe(false)}
      onTouchEnd={() => menuSwipe(true)}
      onTouchCancel={() => menuSwipe(true)}
    >
      {viewport === null ? <View style={{ height: CHART_HEIGHT + 30 }} /> : <BarCanvasHost {...props} viewport={viewport} />}
    </View>
  );
}
