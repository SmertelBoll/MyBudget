import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

type ToastOptions = { action?: { label: string; onPress: () => void }; kind?: "info" | "error" };
type ToastState = ToastOptions & { message: string; id: number };

const ToastContext = createContext<{ show: (message: string, options?: ToastOptions) => void } | null>(null);

const DURATION_MS = 3500;

// Short message at the bottom of the screen (spec 2.6), with an optional action such as "Open payment".
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, options?: ToastOptions) => {
    nextId.current += 1;
    setToast({ message, ...options, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <ToastView toast={toast} onHide={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHide }: { toast: ToastState; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const background = toast.kind === "error" ? colors.danger : colors.text;
  const foreground = toast.kind === "error" ? colors.onDanger : colors.surface;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.xl * 3 }}
    >
      <Pressable
        onPress={onHide}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          backgroundColor: background,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <AppText style={{ flex: 1 }} color={foreground}>
          {toast.message}
        </AppText>
        {toast.action && (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              onHide();
            }}
            hitSlop={8}
          >
            <AppText variant="label" color={colors.accent}>
              {toast.action.label}
            </AppText>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast outside ToastProvider");
  return value;
};
