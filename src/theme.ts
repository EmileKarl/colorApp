import { useColorScheme } from "react-native";

const palette = {
  light: {
    background: "#fbfaf8",
    surface: "#ffffff",
    text: "#1a1a1a",
    subtext: "#6b6b6b",
    border: "#e5e2dc",
    accent: "#111111",
    danger: "#c0392b",
    success: "#1e824c",
  },
  dark: {
    background: "#121212",
    surface: "#1c1c1e",
    text: "#f5f5f5",
    subtext: "#a3a3a3",
    border: "#2c2c2e",
    accent: "#f5f5f5",
    danger: "#ff6b5b",
    success: "#4cd97b",
  },
};

export type Theme = typeof palette.light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
