import { useMemo } from "react";
import { useColorScheme, useWindowDimensions } from "react-native";

import { accessibleAccent } from "./domain/contrast";
import { hexToRgb, isValidHex, rgbToHex } from "./lib/color";

/**
 * ColorLens design system — §5 of the specification.
 *
 * Light: ivory ground, off-white surfaces, near-black text, barely-there
 * borders. Dark: blue-black ground, anthracite surfaces, off-white text.
 * The accent is deliberately neutral by default and becomes the user's
 * captured color wherever a screen has one (see `useAccent`).
 */
const palette = {
  light: {
    // "Ivoire ou gris très clair" — a warm ground rather than pure white, so
    // that a white surface card still reads as a distinct layer above it.
    background: "#faf8f4",
    surface: "#ffffff",
    surfaceAlt: "#f2efe9",
    text: "#141414",
    subtext: "#6b6b6b",
    // "Bordures très discrètes" — low contrast on purpose; elevation is
    // carried by shadow and surface color, not by lines.
    border: "#e7e3db",
    accent: "#141414",
    onAccent: "#ffffff",
    danger: "#c0392b",
    success: "#1e824c",
    warning: "#b26a00",
    overlay: "rgba(12,12,14,0.45)",
    shadow: "#2a2620",
  },
  dark: {
    // "Fond noir bleuté" — a blue-leaning black, not neutral #000, so that
    // captured colors read as colors against it.
    background: "#0e1014",
    surface: "#181b21",
    surfaceAlt: "#20242c",
    text: "#f4f4f2",
    subtext: "#9aa0aa",
    border: "#2a2f38",
    accent: "#f4f4f2",
    onAccent: "#0e1014",
    danger: "#ff6b5b",
    success: "#4cd97b",
    warning: "#ffb545",
    overlay: "rgba(0,0,0,0.6)",
    shadow: "#000000",
  },
};

export type Theme = typeof palette.light;
export type ThemeScheme = "light" | "dark";

export function useThemeScheme(): ThemeScheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme(): Theme {
  return palette[useThemeScheme()];
}

/** Non-hook access, for modules that compute styles outside a component. */
export function themeFor(scheme: ThemeScheme): Theme {
  return palette[scheme];
}

/** "Espacements réguliers" — a single 4 pt scale, used everywhere. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

/** "Coins arrondis" / "boutons en capsule". `pill` is large enough that any
 * realistic control height rounds to a full capsule. */
export const radius = { sm: 8, md: 12, lg: 18, xl: 28, pill: 999 };

/**
 * "Ombres discrètes". Values are deliberately low-opacity: the design leans on
 * surface color for separation, and heavy shadows read as cheap on OLED.
 */
export const elevation = {
  none: {},
  card: {
    shadowColor: palette.light.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: palette.light.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

/**
 * "Hiérarchie typographique claire" — a fixed ramp so that screens cannot
 * invent their own sizes and drift apart.
 *
 * `mono` exists because §5 requires color codes in a monospace face: a
 * proportional font makes `#0047AB` and `#1148BC` different widths, which
 * makes a list of codes visually ragged and harder to compare.
 */
export const type = {
  display: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  heading: { fontSize: 19, fontWeight: "700", letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "400" },
} as const;

/** iOS ships SF Mono under this name; Android resolves "monospace". */
export const monoFontFamily = "Courier";

/**
 * Breakpoints. The audit found that no screen adapted to width at all — the
 * same layout rendered on an iPhone SE and an iPad. These let a screen ask for
 * more columns or a wider gutter without each one re-deriving the rule.
 */
export type SizeClass = "compact" | "regular" | "large";

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const sizeClass: SizeClass = width >= 900 ? "large" : width >= 600 ? "regular" : "compact";
    return {
      width,
      height,
      sizeClass,
      isCompact: sizeClass === "compact",
      /** Side gutter: wider on big screens so content does not stretch edge to edge. */
      gutter: sizeClass === "large" ? spacing.xl : spacing.md,
      /** Content never exceeds this, so a tablet shows a readable column. */
      maxContentWidth: sizeClass === "large" ? 720 : width,
      /** Grid columns for card lists. */
      columns: sizeClass === "large" ? 4 : sizeClass === "regular" ? 3 : 2,
    };
  }, [width, height]);
}

/**
 * Derives a usable accent from a captured color — §5, "accent basé sur la
 * couleur capturée".
 *
 * The captured color is used as-is when it already reads against the current
 * background, and is walked toward the nearest legible version when it does
 * not. This is what lets the UI take on the user's color without any screen
 * becoming unreadable; the measurement lives in `domain/contrast.ts` rather
 * than in a guess about whether a color "looks dark".
 */
export function useAccent(hex?: string | null): { accent: string; onAccent: string } {
  const theme = useTheme();
  return useMemo(() => {
    if (!hex || !isValidHex(hex)) return { accent: theme.accent, onAccent: theme.onAccent };
    const adjusted = accessibleAccent(hexToRgb(hex), hexToRgb(theme.background), "large_text");
    return { accent: rgbToHex(adjusted.color), onAccent: theme.onAccent };
  }, [hex, theme.accent, theme.onAccent, theme.background]);
}
