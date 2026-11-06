import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts } from "@/theme/tokens";

export const NO_LIGATURES: TextStyle["fontVariant"] = ["no-common-ligatures"];

type Variant ="display" | "title" | "heading" | "body" | "label" | "caption";

const VARIANTS = {
  display: { fontFamily: fonts.semibold, fontSize: fontSize.display },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.title },
  heading: { fontFamily: fonts.medium, fontSize: fontSize.heading },
  body: { fontFamily: fonts.regular, fontSize: fontSize.body },
  label: { fontFamily: fonts.medium, fontSize: fontSize.label },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.caption },
} as const;

type Props = TextProps & {
  variant?: Variant;
  secondary?: boolean;
  color?: string;
};

export function AppText({ variant = "body", secondary, color, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        VARIANTS[variant],
        // Rubik joins "fi"/"fl" into one glyph; in titles like "Profile" that reads as a typo.
        { color: color ?? (secondary ? colors.textSecondary : colors.text), fontVariant: NO_LIGATURES },
        style,
      ]}
      {...rest}
    />
  );
}
