// Android only, from index.js before the app starts: the widgets' task handler, their setup screen and the hourly
// background sync must be known even when Android starts the app's code without opening it.
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler, type WidgetTaskHandlerProps } from "react-native-android-widget";
import "./background";
import { readSelection, readSnapshot, removeSelection } from "./snapshot";
import { WidgetConfigScreen } from "./WidgetConfigScreen";
import { WidgetFor } from "./WidgetViews";

const widgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) => {
  if (widgetAction === "WIDGET_DELETED") {
    await removeSelection(widgetInfo.widgetId);
    return;
  }
  // Taps open the app by link (OPEN_URI), handled by Android itself; nothing reaches here for them.
  if (widgetAction === "WIDGET_CLICK") return;
  const [snapshot, selection] = await Promise.all([readSnapshot(), readSelection(widgetInfo.widgetId)]);
  renderWidget(<WidgetFor name={widgetInfo.widgetName} snapshot={snapshot} selection={selection} width={widgetInfo.width} height={widgetInfo.height} />);
};

registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigScreen);
