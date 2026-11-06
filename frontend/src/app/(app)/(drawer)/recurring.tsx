import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 8. Regular payments (data phase).
export default function RecurringScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.recurring")} icon="calendar-sync-outline" />;
}
