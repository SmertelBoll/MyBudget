import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 9. Reminders (data phase).
export default function RemindersScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.reminders")} icon="bell-outline" />;
}
