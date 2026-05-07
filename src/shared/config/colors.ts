import { ColorTree } from "lib/generateColorConfig";

export const colors: ColorTree = {
  // XBlade Gold Theme - Matching landing page #00FFB2
  gold: {
    100: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    300: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    500: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    600: { light: "#00664E", dark: "#00664E" }, // Darker gold for hover
    700: { light: "#003B2E", dark: "#003B2E" }, // Darkest gold for active
  },
  // XBlade accent colors
  "light-blue": {
    100: { light: "#1A1A1A", dark: "#1A1A1A" }, // Dark background accent
    300: { light: "#2A2A2A", dark: "#2A2A2A" }, // Elevated surface
    500: { light: "#2A2A2A", dark: "#2A2A2A" }, // Elevated surface
    600: { light: "#333333", dark: "#333333" }, // Border
    700: { light: "#404040", dark: "#404040" }, // Lighter border
  },
  blue: {
    100: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    300: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    400: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    500: { light: "#00FFB2", dark: "#00FFB2" }, // Primary gold
    600: { light: "#00664E", dark: "#00664E" }, // Darker gold for hover
    700: { light: "#003B2E", dark: "#003B2E" }, // Darkest gold for active
  },
  "cold-blue": {
    500: { light: "#00664E", dark: "#00664E" }, // Darker gold
    700: { light: "#003B2E", dark: "#003B2E" }, // Darkest gold
    900: { light: "#1A1500", dark: "#1A1500" }, // Very dark gold tint
  },
  slate: {
    100: { light: "#666666", dark: "#999999" }, // Secondary text
    400: { light: "#888888", dark: "#AAAAAA" },
    500: { light: "#AAAAAA", dark: "#555555" },
    600: { light: "#CCCCCC", dark: "#2A2A2A" }, // Card border
    700: { light: "#DDDDDD", dark: "#1A1A1A" }, // Card background
    750: { light: "#E5E5E5", dark: "#141414" },
    800: { light: "#F0F0F0", dark: "#111111" }, // Elevated surface
    900: { light: "#FAFAFA", dark: "#0A0A0A" }, // Main background
    950: { light: "#FFFFFF", dark: "#000000" }, // Darkest background (pure black)
  },
  gray: {
    50: { light: "rgba(0, 0, 0, 0.95)", dark: "rgba(255, 255, 255, 0.95)", type: "rgba" },
    100: { light: "#333333", dark: "#e7e7e9" },
    200: { light: "#555555", dark: "#cfcfd3" },
    300: { light: "#777777", dark: "#b7b8bd" },
    400: { light: "#999999", dark: "#9fa0a7" },
    500: { light: "#BBBBBB", dark: "#878891" },
    600: { light: "#DDDDDD", dark: "#70707c" },
    700: { light: "#F0F0F0", dark: "#585866" },
    800: { light: "rgba(0, 0, 0, 0.2)", dark: "rgba(255, 255, 255, 0.2)", type: "rgba" },
    900: { light: "rgba(0, 0, 0, 0.1)", dark: "rgba(255, 255, 255, 0.1)", type: "rgba" },
    950: { light: "rgba(0, 0, 0, 0.05)", dark: "rgba(255, 255, 255, 0.05)", type: "rgba" },
  },
  yellow: {
    300: { light: "#FF9400", dark: "#ffe166" },
    500: { light: "#f3b50c", dark: "#f3b50c" },
    900: { light: "#FFF9D0", dark: "#2E2D29" },
  },
  red: {
    100: { light: "#EA2A46", dark: "#F9A4A5" },
    400: { light: "#ff637a", dark: "#ff637a" },
    500: { light: "#EA2A46", dark: "#FF506A" },
    700: { light: "#B33055", dark: "#B33055" },
    900: { light: "#F9E2E5", dark: "#2D192D" },
  },
  green: {
    100: { light: "#109375", dark: "#A4F9D9" },
    300: { light: "#56dba8", dark: "#56dba8" },
    400: { light: "#8CF3CB", dark: "#8CF3CB" },
    500: { light: "#109375", dark: "#0FDE8D" },
    600: { light: "#DFEFEB", dark: "#1F3445" },
    700: { light: "#0FDE8D", dark: "#0FDE8D" },
    800: { light: "#178969", dark: "#178969" },
    900: { light: "#DFFFEB", dark: "#192E38" },
  },
  white: { light: "#ffffff", dark: "#ffffff" },
  black: { light: "#000000", dark: "#000000" },
  button: {
    secondary: { light: "#E0E0E8", dark: "#1A1A1A" }, // Dark secondary button
    secondaryHover: { light: "#dadce8", dark: "#252525" },
    secondaryDisabled: { light: "#E0E0E8", dark: "#111111" },
    primaryHover: { light: "#00664E", dark: "#00664E" }, // Darker gold hover
    primaryActive: { light: "#003B2E", dark: "#003B2E" }, // Darkest gold active
  },
  fill: {
    surfaceElevated50: { light: "#F0F0F080", dark: "#11111180" },
    surfaceElevated: { light: "#F0F0F0", dark: "#111111" },
    surfaceElevatedHover: { light: "#E8E8E8", dark: "#1A1A1A" },
    surfaceHover: { light: "#0000001A", dark: "#FFFFFF1A" },
    accent: { light: "#E0E0E0", dark: "#2A2A2A" },
  },
  typography: {
    primary: { light: "#000000", dark: "#ffffff" },
    secondary: { light: "#696D96", dark: "#a0a3c4" },
    inactive: { light: "#C4C4D5", dark: "#3E4361" },
  },
};
