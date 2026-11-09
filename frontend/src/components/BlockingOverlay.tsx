import { useSyncExternalStore } from "react";
import { ActivityIndicator, Modal, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

// A full-screen "please wait" over the whole app, for work that replaces all data (restore a backup, delete all
// data). While it's up nothing can be tapped and Back does nothing, so no entry is made that the work would wipe
// and no screen is seen half-loaded.

let message: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Shows the overlay with `text` while `work` runs; hides it whatever happens.
export const whileBlocking = async <T,>(text: string, work: () => Promise<T>): Promise<T> => {
  message = text;
  listeners.forEach((listener) => listener());
  try {
    return await work();
  } finally {
    message = null;
    listeners.forEach((listener) => listener());
  }
};

export function BlockingOverlay() {
  const { colors } = useTheme();
  const text = useSyncExternalStore(subscribe, () => message);
  if (!text) return null;
  return (
    <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={text}
          style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, alignItems: "center", minWidth: 220 }}
        >
          <ActivityIndicator size="large" color={colors.mark} />
          <AppText variant="heading" style={{ textAlign: "center" }}>
            {text}
          </AppText>
        </View>
      </View>
    </Modal>
  );
}
