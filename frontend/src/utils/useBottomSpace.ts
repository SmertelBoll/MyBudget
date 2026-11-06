import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_ACTION_SPACE } from "@/theme/tokens";

// Padding under scrolling content so the pinned bottom button (or the round "+") never covers the last field
// (spec 2.7). The button sits above the system navigation bar, so that height is added too.
export const useBottomSpace = () => BOTTOM_ACTION_SPACE + useSafeAreaInsets().bottom;
