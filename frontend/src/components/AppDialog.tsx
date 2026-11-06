import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";

// The app's only dialog (spec 2.6, no Swal): const ok = await dialog.confirm({...}).

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  // Countdown dialogs (account / data deletion). With autoConfirm the dialog confirms by itself when the time is
  // up and only the cancel button is shown; without it the confirm button stays disabled until the end.
  countdown?: { seconds: number; autoConfirm: boolean };
};

type DialogState = ConfirmOptions & { resolve: (confirmed: boolean) => void };

const DialogContext = createContext<{ confirm: (options: ConfirmOptions) => Promise<boolean> } | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })),
    []
  );

  const close = useCallback(
    (confirmed: boolean) => {
      dialog?.resolve(confirmed);
      setDialog(null);
    },
    [dialog]
  );

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      {dialog && <DialogView key={dialog.title} dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogView({ dialog, onClose }: { dialog: DialogState; onClose: (confirmed: boolean) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [left, setLeft] = useState(dialog.countdown?.seconds ?? 0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!dialog.countdown) return;
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [dialog.countdown]);

  useEffect(() => {
    if (dialog.countdown?.autoConfirm && left === 0) onCloseRef.current(true);
  }, [dialog.countdown, left]);

  const waiting = Boolean(dialog.countdown) && left > 0;
  const autoConfirm = dialog.countdown?.autoConfirm;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => onClose(false)} statusBarTranslucent>
      <Pressable
        onPress={() => onClose(false)}
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.lg }}
      >
        <Pressable
          onPress={() => {}}
          accessibilityRole="alert"
          style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}
        >
          <AppText variant="heading">{dialog.title}</AppText>
          {dialog.message ? <AppText secondary>{dialog.message}</AppText> : null}
          {waiting && (
            <AppText variant="display" style={{ textAlign: "center" }} color={dialog.destructive ? colors.danger : undefined}>
              {t("common.seconds", { count: left })}
            </AppText>
          )}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button variant="secondary" title={dialog.cancelText ?? t("common.cancel")} onPress={() => onClose(false)} />
            {!autoConfirm && (
              <Button
                variant={dialog.destructive ? "danger" : "primary"}
                title={dialog.confirmText ?? t("common.ok")}
                onPress={() => onClose(true)}
                disabled={waiting}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const useDialog = () => {
  const value = useContext(DialogContext);
  if (!value) throw new Error("useDialog outside DialogProvider");
  return value;
};
