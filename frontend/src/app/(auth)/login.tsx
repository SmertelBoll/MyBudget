import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { LogoText } from "@/components/Logo";
import { TextField, type TextInputHandle } from "@/components/TextField";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type Mode = "signIn" | "signUp";

// Screen 1. Email + password; the Google button comes later (see TODO.md).
export default function LoginScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, endedReason } = useAuth();
  const passwordRef = useRef<TextInputHandle>(null);
  const confirmRef = useRef<TextInputHandle>(null);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailError = !email.trim() ? "auth.emailRequired" : !EMAIL_PATTERN.test(email.trim()) ? "auth.emailInvalid" : null;
  const passwordError = !password
    ? "auth.passwordRequired"
    : mode === "signUp" && password.length < MIN_PASSWORD
      ? "auth.passwordTooShort"
      : null;
  // Registration only: a typo in a password nobody has seen would lock the user out.
  const confirmError =
    mode !== "signUp" ? null : !confirm ? "auth.confirmRequired" : confirm !== password ? "auth.passwordsDontMatch" : null;
  // Spec 2.7: errors only after leaving a field or trying to submit.
  const showEmailError = (touched.email || submitted) && emailError;
  const showPasswordError = (touched.password || submitted) && passwordError;
  const showConfirmError = (touched.confirm || submitted) && confirmError;
  const invalid = Boolean(emailError || passwordError || confirmError);

  const submit = async () => {
    setSubmitted(true);
    setServerError(null);
    if (invalid) return;

    setLoading(true);
    try {
      await (mode === "signIn" ? signIn : signUp)(email.trim(), password);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.code : "common.serverError");
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "signIn" ? "signUp" : "signIn"));
    setConfirm("");
    setTouched((value) => ({ ...value, confirm: false }));
    setSubmitted(false);
    setServerError(null);
  };

  const notice = serverError ?? endedReason;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <LogoText size={32} />
          <AppText secondary style={{ textAlign: "center" }}>
            {t("app.tagline")}
          </AppText>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md }}>
          <AppText variant="title">{t(mode === "signIn" ? "auth.signIn" : "auth.signUp")}</AppText>

          {notice && (
            <View style={{ backgroundColor: colors.danger, borderRadius: radius.md, padding: spacing.md }}>
              <AppText color={colors.onDanger}>{t(notice)}</AppText>
            </View>
          )}

          <TextField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched((value) => ({ ...value, email: true }))}
            error={showEmailError ? t(showEmailError) : undefined}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setTouched((value) => ({ ...value, password: true }))}
            error={showPasswordError ? t(showPasswordError) : undefined}
            hint={mode === "signUp" ? t("auth.passwordHint") : undefined}
            secure
            autoCapitalize="none"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            textContentType={mode === "signIn" ? "password" : "newPassword"}
            returnKeyType={mode === "signIn" ? "go" : "next"}
            onSubmitEditing={mode === "signIn" ? submit : () => confirmRef.current?.focus()}
          />
          {mode === "signUp" && (
            <TextField
              ref={confirmRef}
              label={t("auth.confirmPassword")}
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setTouched((value) => ({ ...value, confirm: true }))}
              error={showConfirmError ? t(showConfirmError) : undefined}
              secure
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}

          <Button
            title={t(mode === "signIn" ? "auth.signIn" : "auth.signUp")}
            onPress={submit}
            loading={loading}
            muted={invalid}
          />

          <Pressable onPress={switchMode} hitSlop={8} style={{ alignSelf: "center", padding: spacing.sm }}>
            <AppText variant="label" secondary>
              {t(mode === "signIn" ? "auth.toSignUp" : "auth.toSignIn")}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
