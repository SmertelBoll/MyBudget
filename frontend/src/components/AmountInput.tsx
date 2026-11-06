import { useState, type Ref } from "react";
import { Pressable, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fonts, spacing } from "@/theme/tokens";
import { useMoney } from "@/utils/useMoney";
import { AppText, NO_LIGATURES } from "./AppText";
import { CalculatorModal } from "./CalculatorModal";
import type { TextInputHandle } from "./TextField";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  currency: string;
  // Makes the currency tappable (e.g. picking an account's currency at creation).
  onCurrencyPress?: () => void;
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
  // Account balances only (a credit card can be below zero); entries are always positive.
  allowNegative?: boolean;
};

const cleanAmount = (text: string, allowNegative: boolean) => {
  const digits = text.replace(/[^\d.,]/g, "");
  return allowNegative && text.trim().startsWith("-") ? `-${digits}` : digits;
};

// Spec 2.9 AmountInput: big amount, currency, calculator.
export function AmountInput({
  value,
  onChangeText,
  currency,
  onCurrencyPress,
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

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(text) => onChangeText(cleanAmount(text, allowNegative))}
          placeholder={placeholder ?? "0"}
          placeholderTextColor={colors.textSecondary}
          // The decimal pad has no minus key, so balances get the full numeric keyboard.
          keyboardType={allowNegative ? "numbers-and-punctuation" : "decimal-pad"}
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
        <Pressable onPress={onCurrencyPress} disabled={!onCurrencyPress} hitSlop={8} accessibilityRole={onCurrencyPress ? "button" : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppText style={{ fontFamily: fonts.medium, fontSize: textSize * 0.8 }}>{currency}</AppText>
            {onCurrencyPress && <MaterialCommunityIcons name="menu-down" size={24} color={colors.text} />}
          </View>
        </Pressable>
        {action !== "none" && (
          <Pressable
            onPress={action === "calculator" ? () => setCalculator(true) : onConvert}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(action === "calculator" ? "calculator.open" : "amount.convert")}
            style={{ padding: spacing.xs }}
          >
            <MaterialCommunityIcons
              name={action === "calculator" ? "calculator-variant-outline" : "swap-vertical"}
              size={28}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      {calculator && (
        <CalculatorModal
          visible
          initial={value}
          decimalSeparator={format.decimalSeparator}
          onClose={() => setCalculator(false)}
          onResult={(result) => onChangeText(toInput(Math.round(result * 100)))}
        />
      )}
    </View>
  );
}
