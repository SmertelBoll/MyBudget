import { TextInput } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts, spacing } from "@/theme/tokens";
import { NO_LIGATURES } from "./AppText";

// The header turned into a search field (spec 2.9 ScreenHeader "search mode", screen 11).
export function HeaderSearchInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (text: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      autoFocus
      returnKeyType="search"
      style={{
        alignSelf: "stretch",
        color: colors.text,
        fontFamily: fonts.regular,
        fontSize: fontSize.body,
        fontVariant: NO_LIGATURES,
        paddingVertical: spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: colors.mark,
      }}
    />
  );
}
