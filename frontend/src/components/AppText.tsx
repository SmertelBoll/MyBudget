import { Children } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts } from "@/theme/tokens";

// Rubik joins "fi"/"fl"/"ff" into one glyph; in words like "Profile" that reads as a typo. The font feature switch
// below works on iOS and the web, but Android ignored it, so a zero-width non-joiner is also put between the letters.
export const NO_LIGATURES: TextStyle["fontVariant"] = ["no-common-ligatures"];
const ZWNJ = "‌";
export const breakLigatures = (text: string) => text.replace(/f(?=[fil])/g, `f${ZWNJ}`);

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption";

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

export function AppText({ variant = "body", secondary, color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        VARIANTS[variant],
        { color: color ?? (secondary ? colors.textSecondary : colors.text), fontVariant: NO_LIGATURES },
        style,
      ]}
      {...rest}
    >
      {Children.map(children, (child) => (typeof child === "string" ? breakLigatures(child) : child))}
    </Text>
  );
}
