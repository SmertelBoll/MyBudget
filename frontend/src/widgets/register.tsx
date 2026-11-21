// Android only, from index.js before the app starts: the widgets' task handler, their setup screen and the hourly
// background sync must be known even when Android starts the app's code without opening it.
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler, type WidgetTaskHandlerProps } from "react-native-android-widget";
import "./background";
import { readOffset, readSelection, readSnapshot, removeSelection, writeOffset } from "./snapshot";
import { WidgetConfigScreen } from "./WidgetConfigScreen";
import { categoriesThatFit, SCROLL_DOWN, SCROLL_UP, scrolled, WidgetFor } from "./WidgetViews";

const widgetTaskHandler = async ({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) => {
  const id = widgetInfo.widgetId;
  if (widgetAction === "WIDGET_DELETED") {
    await removeSelection(id);
    return;
  }
  // Taps that open a new entry go by link (OPEN_URI), handled by Android itself; only the right half of 4×2, which
  // moves its categories by one, reaches here.
  const scroll = widgetAction === "WIDGET_CLICK" && (clickAction === SCROLL_UP || clickAction === SCROLL_DOWN);
  if (widgetAction === "WIDGET_CLICK" && !scroll) return;
  const [snapshot, selection, saved] = await Promise.all([readSnapshot(), readSelection(id), readOffset(id)]);
  let offset = saved;
  if (scroll && snapshot) {
    const shown = categoriesThatFit(widgetInfo.height, widgetInfo.screenInfo?.fontScale);
    offset = scrolled(saved, clickAction!, snapshot.top[selection.side].length, shown);
    await writeOffset(id, offset);
  }
  renderWidget(<WidgetFor name={widgetInfo.widgetName} snapshot={snapshot} selection={selection} width={widgetInfo.width} height={widgetInfo.height} fontScale={widgetInfo.screenInfo?.fontScale} offset={offset} />);
};

registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigScreen);
