import { Text, type TextProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontSize, fonts } from "@/theme/tokens";

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

export function AppText({ variant = "body", secondary, color, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      style={[VARIANTS[variant], { color: color ?? (secondary ? colors.textSecondary : colors.text) }, style]}
      {...rest}
    />
  );
}
