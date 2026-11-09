import { useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { ApiError, api, isNetworkError } from "@/api/client";
import type { User } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/tokens";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { AppText } from "@/components/AppText";
import { BottomActionButton } from "@/components/BottomActionButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField, type TextInputHandle } from "@/components/TextField";
import { useToast } from "@/components/Toast";

const MIN_LENGTH = 8;

// Settings -> Security -> "Change password". Online only: the server checks the current password and signs every
// other device out. An account made through Google alone sets its first password here (no current one to give).
export default function PasswordScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user, acceptUser } = useAuth();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const hasPassword = user?.hasPassword !== false;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<{ field: "current" | "next"; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const nextRef = useRef<TextInputHandle>(null);
  const repeatRef = useRef<TextInputHandle>(null);

  const errors = {
    current: hasPassword && !current ? "auth.passwordRequired" : serverError?.field === "current" ? serverError.code : null,
    next: next.length < MIN_LENGTH ? "auth.passwordTooShort" : serverError?.field === "next" ? serverError.code : null,
    repeat: !repeat ? "auth.confirmRequired" : repeat !== next ? "auth.passwordsDontMatch" : null,
  };
  const shown = (key: keyof typeof errors) => ((submitted || serverError) && errors[key] ? t(errors[key]!) : undefined);

  const save = async () => {
    setSubmitted(true);
    if (errors.current || errors.next || errors.repeat) return;
    setSaving(true);
    try {
      const { user: saved, endedSessions } = await api.post<{ user: User; endedSessions: number }>("/me/password", {
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      acceptUser(saved);
      toast.show(t(endedSessions ? "password.changedOthersOut" : "password.changed"));
      if (router.canGoBack()) router.back();
      else router.replace("/settings");
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.code === "auth.wrongPassword") setServerError({ field: "current", code: error.code });
      else if (error instanceof ApiError && error.code.startsWith("auth.password")) setServerError({ field: "next", code: error.code });
      else toast.show(t(isNetworkError(error) ? "password.offline" : error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t(hasPassword ? "password.title" : "password.setTitle")} left="back" />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomSpace }}
      >
        <AppText secondary>{t(hasPassword ? "password.hint" : "password.setHint")}</AppText>
        {hasPassword && (
          <TextField
            label={t("password.current")}
            value={current}
            onChangeText={(text) => {
              setCurrent(text);
              if (serverError?.field === "current") setServerError(null);
            }}
            error={shown("current")}
            secure
            autoFocus
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => nextRef.current?.focus()}
          />
        )}
        <TextField
          ref={nextRef}
          label={t("password.new")}
          value={next}
          onChangeText={(text) => {
            setNext(text);
            if (serverError?.field === "next") setServerError(null);
          }}
          error={shown("next")}
          hint={t("auth.passwordHint")}
          secure
          autoFocus={!hasPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => repeatRef.current?.focus()}
        />
        <TextField
          ref={repeatRef}
          label={t("password.repeat")}
          value={repeat}
          onChangeText={setRepeat}
          error={shown("repeat")}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={save}
        />
      </KeyboardAwareScrollView>
      <BottomActionButton title={t("common.save")} onPress={save} loading={saving} />
    </View>
  );
}
