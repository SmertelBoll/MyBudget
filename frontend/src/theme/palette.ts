// Colors from the MovieList site (frontend/src/theme/palette.js there). Components never hardcode colors: they take
// them from useTheme().colors.

// Contrast pair for text on any colored background.
export const CONTRAST_DARK = "#0C1618";
export const CONTRAST_LIGHT = "#FAF8FF";

const SHARED = {
  // Yellow is light in both themes, so text and icons on it are always dark (same rule as MovieList).
  accent: "#F9F919",
  accentPressed: "#F2DB0B",
  onAccent: CONTRAST_DARK,
  // Inactive primary button: a dim solid yellow, not a transparent one.
  accentMuted: "#d8d87a",
  onAccentMuted: "#5c5c33",
  danger: "#dd3333",
  dangerPressed: "#b32020",
  onDanger: CONTRAST_LIGHT,
  // Positive difference on charts (spec screen 6)
  positive: "#3085d6",
  negative: "#dd3333",
  scrim: "rgba(0,0,0,0.45)",
};

export type SchemeName = "light" | "dark";

export type Palette = typeof SHARED & {
  scheme: SchemeName;
  // Screen background
  background: string;
  // Header, cards, dialogs
  surface: string;
  // Pressed rows, selected chips, field borders
  selected: string;
  text: string;
  textSecondary: string;
  // Circle behind icons that aren't chosen in a picker: clearly visible on `surface`, but quieter than a color.
  iconIdle: string;
  // Small round buttons next to values (balance details, calculator): darker than the card so they read as buttons.
  tonal: string;
};

const LIGHT: Palette = {
  ...SHARED,
  scheme: "light",
  background: "#e6e4da",
  surface: "#FAF8FF",
  selected: "#cccccc",
  text: CONTRAST_DARK,
  // Darker than MovieList's #696969: on the beige background that grey was hard to read (contrast ~4.1:1).
  textSecondary: "#555555",
  iconIdle: "#a9a9a9",
  tonal: "#d6d4ca",
};

const DARK: Palette = {
  ...SHARED,
  scheme: "dark",
  background: "#363636",
  surface: "#171717",
  selected: "#595959",
  text: CONTRAST_LIGHT,
  textSecondary: "#999999",
  iconIdle: "#7c8580",
  tonal: "#4a4a4a",
};

export const getPalette = (scheme: SchemeName): Palette => (scheme === "dark" ? DARK : LIGHT);
