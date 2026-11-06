import { useState, type ComponentRef, type Ref } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts, radius, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";

export type TextInputHandle = ComponentRef<typeof TextInput>;

type Props = Omit<TextInputProps, "ref"> & {
  ref?: Ref<TextInputHandle>;
  label: string;
  // Already translated. The form decides when to pass it: after blur or a save attempt, never on an untouched
  // form (spec 2.7).
  error?: string;
  hint?: string;
  secure?: boolean;
};

export function TextField({ ref, label, error, hint, secure, onFocus, onBlur, style, ...inputProps }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.selected;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">
        {label}
      </AppText>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secure && hidden}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              minHeight: 48,
              paddingHorizontal: spacing.md,
              color: colors.text,
              fontFamily: fonts.regular,
              fontSize: fontSize.body,
            },
            style,
          ]}
          {...inputProps}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityLabel={t(hidden ? "auth.showPassword" : "auth.hidePassword")}
            hitSlop={8}
            style={{ paddingHorizontal: spacing.md }}
          >
            <MaterialCommunityIcons name={hidden ? "eye-outline" : "eye-off-outline"} size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" secondary>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
