import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, radius, spacing } from "@/theme/tokens";
import { evaluate } from "@/utils/calc";
import { AppText } from "./AppText";

const KEYS = [
  ["C", "(", ")", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["%", "0", ".", "⌫"],
];
const OPERATORS = new Set(["÷", "×", "−", "+", "%", "(", ")"]);

// Spec 4.2: a calculator window; "=" puts the result into the amount field. The result must be above zero.
export function CalculatorModal({
  visible,
  initial,
  decimalSeparator,
  onClose,
  onResult,
}: {
  visible: boolean;
  initial: string;
  decimalSeparator: "." | ",";
  onClose: () => void;
  onResult: (value: number) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent onShow={() => setExpression(initial)}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "center", padding: spacing.md }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
          <View style={{ minHeight: 72, justifyContent: "flex-end", alignItems: "flex-end", paddingHorizontal: spacing.sm }}>
            <AppText variant="title" numberOfLines={2} style={{ textAlign: "right" }}>
              {expression || "0"}
            </AppText>
            <AppText secondary color={error ? colors.danger : undefined}>
              {error ?? (preview !== null && expression ? `= ${preview}` : " ")}
            </AppText>
          </View>

          {KEYS.map((row) => (
            <View key={row.join("")} style={{ flexDirection: "row", gap: spacing.sm }}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => press(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === "⌫" ? t("calculator.backspace") : key}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 56,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? colors.selected : colors.background,
                  })}
                >
                  {key === "⌫" ? (
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.text} />
                  ) : (
                    <AppText style={{ fontSize: fontSize.title }} color={OPERATORS.has(key) || key === "C" ? colors.textSecondary : colors.text}>
                      {key === "." ? decimalSeparator : key}
                    </AppText>
                  )}
                </Pressable>
              ))}
            </View>
          ))}

          <Pressable
            onPress={equals}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 56,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            })}
          >
            <AppText style={{ fontSize: fontSize.title }} color={colors.onAccent}>
              =
            </AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
