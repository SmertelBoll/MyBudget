// The browser preview's entry: Skia's engine (CanvasKit, public/canvaskit.wasm, put there by `npm run skia:web`) loads
// before the app, as the chart draws with Skia. Without the file the app still starts; only the chart stays empty.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" })
  .catch((error) => console.warn("Skia didn't load:", error))
  .then(() => {
    require("expo-router/entry");
  });
