import { useState } from "react";
import { View } from "react-native";
import { spacing } from "@/theme/tokens";
import { parseAmount } from "@/utils/money";
import { useMoney } from "@/utils/useMoney";
import { AmountInput } from "./AmountInput";

type Side = "top" | "bottom";

// Spec 4.3, two currencies: the top field in the entry currency, the bottom one in the account's (for a transfer:
// "from" and "to"). An empty field shows the faint amount converted at today's rate.
//   The focused field has the calculator; the other one has the arrows. The arrows only overwrite a number that was
//   already typed into their field; on an empty field (showing just the faint suggestion) they do nothing (Q7).
export function AmountPair({
  top,
  bottom,
  onChangeTop,
  onChangeBottom,
  topCurrency,
  bottomCurrency,
  rate,
  topError,
  bottomError,
  autoFocus,
  onTopCurrencyPress,
}: {
  top: string;
  bottom: string;
  onChangeTop: (text: string) => void;
  onChangeBottom: (text: string) => void;
  topCurrency: string;
  bottomCurrency: string;
  // Bottom units per top unit; null when a currency has no rate.
  rate: number | null;
  topError?: string;
  bottomError?: string;
  autoFocus?: boolean;
  onTopCurrencyPress?: () => void;
}) {
  const { toInput } = useMoney();
  const [focused, setFocused] = useState<Side>("top");

  const topMinor = parseAmount(top);
  const bottomMinor = parseAmount(bottom);
  const topSuggestion = !top && bottomMinor && rate ? toInput(Math.round(bottomMinor / rate)) : undefined;
  const bottomSuggestion = !bottom && topMinor && rate ? toInput(Math.round(topMinor * rate)) : undefined;

  const fillTop = () => {
    if (top && bottomMinor && rate) onChangeTop(toInput(Math.round(bottomMinor / rate)));
  };
  const fillBottom = () => {
    if (bottom && topMinor && rate) onChangeBottom(toInput(Math.round(topMinor * rate)));
  };

  return (
    <View style={{ gap: spacing.md }}>
      <AmountInput
        value={top}
        onChangeText={onChangeTop}
        currency={topCurrency}
        onCurrencyPress={onTopCurrencyPress}
        placeholder={topSuggestion}
        error={topError}
        autoFocus={autoFocus}
        onFocus={() => setFocused("top")}
        action={focused === "top" ? "calculator" : "convert"}
        onConvert={fillTop}
        size="normal"
      />
      <AmountInput
        value={bottom}
        onChangeText={onChangeBottom}
        currency={bottomCurrency}
        placeholder={bottomSuggestion}
        error={bottomError}
        onFocus={() => setFocused("bottom")}
        action={focused === "bottom" ? "calculator" : "convert"}
        onConvert={fillBottom}
        size="normal"
      />
    </View>
  );
}

// What gets saved: the typed amounts, or the converted one when the bottom field was left empty (spec 4.3:
// "if the second field is empty, the automatic rate is used").
export const resolvePair = (top: string, bottom: string, rate: number | null) => {
  const topMinor = parseAmount(top);
  const typedBottom = parseAmount(bottom);
  const bottomMinor = typedBottom ?? (topMinor !== null && rate ? Math.round(topMinor * rate) : null);
  return { topMinor, bottomMinor };
};
