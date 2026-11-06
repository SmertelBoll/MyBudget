import { useState, type Ref } from "react";
import { TextInput, View } from "react-native";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppText, NO_LIGATURES } from "./AppText";
import { CalculatorModal } from "./CalculatorModal";
import { IconButton } from "./IconButton";
import type { TextInputHandle } from "./TextField";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  currency: string;
  // Faint suggestion shown while the field is empty (converted amount, spec 4.3).
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
  // "calculator" opens the calculator; "convert" (the two arrows) calls onConvert.
  action?: "calculator" | "convert" | "none";
  onConvert?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ref?: Ref<TextInputHandle>;
  size?: "large" | "normal";
  // Account balances only (a credit card can be below zero): a ± button, because the number pad has no minus key.
  allowNegative?: boolean;
};

const digitsOnly = (text: string) => text.replace(/[^\d.,]/g, "");

// Spec 2.9 AmountInput: big amount, currency, calculator.
export function AmountInput({
  value,
  onChangeText,
  currency,
  placeholder,
  error,
  autoFocus,
  action = "calculator",
  onConvert,
  onFocus,
  onBlur,
  ref,
  size = "large",
  allowNegative = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { toInput, format } = useMoney();
  const [calculator, setCalculator] = useState(false);
  const textSize = size === "large" ? 34 : 26;

  const negative = allowNegative && value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const emit = (nextDigits: string, nextNegative = negative) => onChangeText(nextNegative ? `-${nextDigits}` : nextDigits);

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {allowNegative && (
          <IconButton icon="plus-minus-variant" label={t("amount.toggleSign")} active={negative} onPress={() => emit(digits, !negative)} />
        )}
        {negative && <AppText style={{ fontFamily: fonts.medium, fontSize: textSize }}>−</AppText>}
        <TextInput
          ref={ref}
          value={digits}
          onChangeText={(text) => emit(digitsOnly(text))}
          placeholder={placeholder ?? "0"}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoFocus={autoFocus}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={currency}
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.text,
            fontFamily: fonts.medium,
            fontSize: textSize,
            fontVariant: NO_LIGATURES,
            paddingVertical: spacing.xs,
            borderBottomWidth: 2,
            borderBottomColor: error ? colors.danger : colors.selected,
          }}
        />
        <AppText style={{ fontFamily: fonts.medium, fontSize: textSize * 0.75 }}>{currency}</AppText>
        {action !== "none" && (
          <IconButton
            icon={action === "calculator" ? "calculator-variant-outline" : "swap-vertical"}
            label={t(action === "calculator" ? "calculator.open" : "amount.convert")}
            onPress={action === "calculator" ? () => setCalculator(true) : onConvert}
          />
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      {calculator && (
        <CalculatorModal
          initial={digits}
          decimalSeparator={format.decimalSeparator}
          onClose={() => setCalculator(false)}
          onResult={(result) => emit(toInput(Math.round(result * 100)))}
        />
      )}
    </View>
  );
}
