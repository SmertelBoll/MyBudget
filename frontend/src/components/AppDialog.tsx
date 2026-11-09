import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { TextField } from "./TextField";

// The app's only dialog (spec 2.6, no Swal):
//   const ok = await dialog.confirm({...});      -> true / false
//   const pick = await dialog.choose({...});     -> chosen option's value, or null when dismissed
//   const text = await dialog.prompt({...});     -> entered text, or null when dismissed

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

export type ChoiceOption = { value: string; label: string; destructive?: boolean };

// selected: the current value, shown filled.
type ChooseOptions = { title: string; message?: string; options: ChoiceOption[]; cancelText?: string; selected?: string };

type PromptOptions = {
  title: string;
  label: string;
  initial?: string;
  maxLength?: number;
  confirmText?: string;
  // Returns an error message (already translated) or null; checked on confirm.
  validate?: (value: string) => string | null;
};

type DialogState =
  | (ConfirmOptions & { kind: "confirm"; resolve: (confirmed: boolean) => void })
  | (ChooseOptions & { kind: "choose"; resolve: (value: string | null) => void })
  | (PromptOptions & { kind: "prompt"; resolve: (value: string | null) => void });

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  choose: (options: ChooseOptions) => Promise<string | null>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => setDialog({ ...options, kind: "confirm", resolve })),
      choose: (options) => new Promise<string | null>((resolve) => setDialog({ ...options, kind: "choose", resolve })),
      prompt: (options) => new Promise<string | null>((resolve) => setDialog({ ...options, kind: "prompt", resolve })),
    }),
    []
  );

  // Confirm dialogs get true/false; choice dialogs the option's value, or null for "cancel".
  const close = useCallback(
    (result: boolean | string | null) => {
      if (!dialog) return;
      if (dialog.kind === "confirm") dialog.resolve(result === true);
      else dialog.resolve(typeof result === "string" ? result : null);
      setDialog(null);
    },
    [dialog]
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog?.kind === "confirm" && <DialogView key={dialog.title} dialog={dialog} onClose={close} />}
      {dialog?.kind === "choose" && <ChoiceView key={dialog.title} dialog={dialog} onClose={close} />}
      {dialog?.kind === "prompt" && <PromptView key={dialog.title} dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogView({ dialog, onClose }: { dialog: ConfirmOptions; onClose: (confirmed: boolean) => void }) {
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

function ChoiceView({ dialog, onClose }: { dialog: ChooseOptions; onClose: (value: string | null) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Modal transparent animationType="fade" onRequestClose={() => onClose(null)} statusBarTranslucent>
      <Pressable
        onPress={() => onClose(null)}
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.lg }}
      >
        <Pressable
          onPress={() => {}}
          accessibilityRole="alert"
          style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, maxHeight: "100%" }}
        >
          <AppText variant="heading">{dialog.title}</AppText>
          {dialog.message ? <AppText secondary>{dialog.message}</AppText> : null}
          {/* Meant for a few options; should there be more than fit, they scroll and Cancel stays in view. */}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.sm }}>
            {dialog.options.map((option) => (
              <Button
                key={option.value}
                variant={option.destructive ? "danger" : option.value === dialog.selected ? "primary" : "secondary"}
                title={option.label}
                onPress={() => onClose(option.value)}
              />
            ))}
          </ScrollView>
          <Button variant="text" title={dialog.cancelText ?? t("common.cancel")} onPress={() => onClose(null)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PromptView({ dialog, onClose }: { dialog: PromptOptions; onClose: (value: string | null) => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [value, setValue] = useState(dialog.initial ?? "");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const trimmed = value.trim();
    const problem = !trimmed ? t("common.required") : (dialog.validate?.(trimmed) ?? null);
    if (problem) return setError(problem);
    onClose(trimmed);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={() => onClose(null)} statusBarTranslucent>
      {/* The dialog moves up with the keyboard, so the field is never under it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Pressable onPress={() => onClose(null)} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.lg }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="heading">{dialog.title}</AppText>
          <TextField
            label={dialog.label}
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setError(null);
            }}
            maxLength={dialog.maxLength}
            error={error ?? undefined}
            hint={dialog.maxLength ? `${value.length}/${dialog.maxLength}` : undefined}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Button variant="secondary" title={t("common.cancel")} onPress={() => onClose(null)} />
            <Button title={dialog.confirmText ?? t("common.ok")} onPress={confirm} />
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const useDialog = () => {
  const value = useContext(DialogContext);
  if (!value) throw new Error("useDialog outside DialogProvider");
  return value;
};
