import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ApiError } from "@/api/client";
import { sendSupportMessage } from "@/data/support";
import { requestSync } from "@/data/sync";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { KEYBOARD_GAP } from "@/utils/keyboard";
import { useBottomSpace } from "@/utils/useBottomSpace";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { PhotoStrip } from "@/components/entry/PhotoStrip";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/Toast";

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 5000;

// Screen 3 "Contact the support": subject + message + an optional screenshot. The app version and the phone model
// are added by themselves. Offline the message waits and goes later.
export default function SupportScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const bottomSpace = useBottomSpace();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);

  const subjectError = tried && !subject.trim() ? t("common.required") : undefined;
  const messageError = tried && !message.trim() ? t("common.required") : undefined;

  const send = async () => {
    setTried(true);
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      // The screenshot is a photo like a transaction's: the sync uploads it.
      if (screenshot.length) await requestSync();
      const result = await sendSupportMessage({ subject: subject.trim(), message: message.trim(), screenshotPhotoId: screenshot[0] });
      toast.show(t(result === "sent" ? "support.sent" : "support.queued"));
      setSubject("");
      setMessage("");
      setScreenshot([]);
      setTried(false);
    } catch (error) {
      toast.show(t(error instanceof ApiError ? error.code : "common.serverError"), { kind: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("nav.support")} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomSpace }}
      >
        <AppText secondary>{t("support.intro")}</AppText>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md }}>
          <TextField label={t("support.subject")} value={subject} onChangeText={setSubject} maxLength={SUBJECT_MAX} error={subjectError} />
          <TextField
            label={t("support.message")}
            value={message}
            onChangeText={setMessage}
            maxLength={MESSAGE_MAX}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 140 }}
            error={messageError}
          />
          <PhotoStrip value={screenshot} onChange={setScreenshot} max={1} label={t("support.screenshot")} />
        </View>
        <AppText variant="caption" secondary>
          {t("support.deviceNote")}
        </AppText>
        <Button title={t("support.send")} icon="send" onPress={send} loading={sending} />
      </KeyboardAwareScrollView>
    </View>
  );
}
