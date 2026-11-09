import BarCanvas from "./BarCanvas";
import type { ChartProps } from "./chartShared";

// The canvas chart. (In the browser, index.web.js loads Skia before the app starts.)
export function BarCanvasHost(props: ChartProps & { viewport: number }) {
  return <BarCanvas {...props} />;
}
