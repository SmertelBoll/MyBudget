import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";
import { evaluate } from "@/utils/calc";
import { AppText } from "./AppText";
import { FullScreenModal } from "./FullScreenModal";

const KEYS = [
  ["C", "(", ")", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["%", "0", ".", "⌫"],
];
const OPERATORS = new Set(["÷", "×", "−", "+", "%", "(", ")", "C"]);

// Spec 4.2: the calculator on its own screen; "=" puts the result into the amount field. The result must be above
// zero.
export function CalculatorModal({
  initial,
  decimalSeparator,
  onClose,
  onResult,
}: {
  initial: string;
  decimalSeparator: "." | ",";
  onClose: () => void;
  onResult: (value: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [expression, setExpression] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const preview = evaluate(expression);

  const press = (key: string) => {
    setError(null);
    if (key === "C") setExpression("");
    else if (key === "⌫") setExpression((value) => value.slice(0, -1));
    else setExpression((value) => value + (key === "." ? decimalSeparator : key));
  };

  const equals = () => {
    const result = evaluate(expression);
    if (result === null) return setError(t("calculator.invalid"));
    if (result <= 0) return setError(t("calculator.mustBePositive"));
    onResult(result);
    onClose();
  };

  const keyStyle = (pressed: boolean, operator: boolean) => ({
    flex: 1,
    borderRadius: radius.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: pressed ? colors.selected : operator ? colors.tonal : colors.surface,
  });

  return (
    <FullScreenModal visible title={t("calculator.open")} onClose={onClose}>
      <View style={{ flex: 1, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.sm }}>
        <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "flex-end", paddingHorizontal: spacing.sm, gap: spacing.xs }}>
          <AppText variant="display" numberOfLines={3} style={{ textAlign: "right", fontSize: 40 }}>
            {expression || "0"}
          </AppText>
          <AppText variant="heading" secondary color={error ? colors.danger : undefined}>
            {error ?? (preview !== null && expression ? `= ${preview}` : " ")}
          </AppText>
        </View>

        <View style={{ flex: 2, gap: spacing.sm }}>
          {KEYS.map((row) => (
            <View key={row.join("")} style={{ flex: 1, flexDirection: "row", gap: spacing.sm }}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => press(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === "⌫" ? t("calculator.backspace") : key}
                  style={({ pressed }) => keyStyle(pressed, OPERATORS.has(key))}
                >
                  {key === "⌫" ? (
                    <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.text} />
                  ) : (
                    <AppText style={{ fontSize: 28 }}>{key === "." ? decimalSeparator : key}</AppText>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            onPress={equals}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            })}
          >
            <AppText style={{ fontSize: 28 }} color={colors.onAccent}>
              =
            </AppText>
          </Pressable>
        </View>
      </View>
    </FullScreenModal>
  );
}
