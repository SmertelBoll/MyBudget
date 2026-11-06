// Spacing, radii and fonts: the non-color design tokens (spec 2.3).

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

// Rubik covers Cyrillic (MovieList pairs it with Kanit, which doesn't); Bungee is the logo font, as on the site.
export const fonts = {
  regular: "Rubik_400Regular",
  medium: "Rubik_500Medium",
  semibold: "Rubik_600SemiBold",
  logo: "Bungee_400Regular",
} as const;

export const fontSize = {
  caption: 13,
  label: 14,
  body: 16,
  heading: 18,
  title: 22,
  display: 32,
} as const;

// Room left under scrolling content so the pinned bottom button never covers the last item (spec 2.7).
export const BOTTOM_ACTION_SPACE = 104;
