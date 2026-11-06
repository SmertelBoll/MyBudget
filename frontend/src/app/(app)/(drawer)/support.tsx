import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 3. Contact the support (later stage).
export default function SupportScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.support")} icon="email-outline" />;
}
