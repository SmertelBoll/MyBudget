import { ComingSoon } from "@/components/ComingSoon";
import { useI18n } from "@/i18n/I18nProvider";

// Screen 7. Categories and tags (data phase).
export default function CategoriesScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.categories")} icon="shape-outline" />;
}
