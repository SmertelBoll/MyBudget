import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { getPalette, type Palette, type SchemeName } from "./palette";

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  colors: Palette;
  scheme: SchemeName;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  const scheme: SchemeName = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const value = useMemo(() => ({ colors: getPalette(scheme), scheme }), [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme outside ThemeProvider");
  return value;
};
