import { requestWidgetUpdate } from "react-native-android-widget";
import { readSelection, writeSnapshot, type WidgetSnapshot } from "./snapshot";
import { WIDGET_NAMES, WidgetFor } from "./WidgetViews";

// Saves the snapshot and redraws every widget on the home screen with it (each with its own Total or account).
export const refreshWidgets = async (snapshot: WidgetSnapshot) => {
  await writeSnapshot(snapshot);
  for (const name of Object.values(WIDGET_NAMES)) {
    await requestWidgetUpdate({
      widgetName: name,
      renderWidget: async (info) => (
        <WidgetFor name={name} snapshot={snapshot} selection={await readSelection(info.widgetId)} width={info.width} height={info.height} />
      ),
    });
  }
};
