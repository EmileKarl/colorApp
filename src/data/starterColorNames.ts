import type { NamedColor } from "../lib/color";

/**
 * Small curated fallback dictionary used to give a scanned color an
 * immediate, reasonable name before any community name has been approved
 * for it (or when the user has no network connection). Community-submitted
 * names always take priority once approved — see src/lib/communityApi.ts.
 */
export const STARTER_COLOR_NAMES: NamedColor[] = [
  { name: "Rouge coquelicot", hex: "#e2231a", family: "red" },
  { name: "Rouge bordeaux", hex: "#6d071a", family: "red" },
  { name: "Corail", hex: "#ff6f61", family: "orange" },
  { name: "Orange citrouille", hex: "#f97316", family: "orange" },
  { name: "Ambre", hex: "#ffbf00", family: "yellow" },
  { name: "Jaune citron", hex: "#fff44f", family: "yellow" },
  { name: "Moutarde", hex: "#c9a227", family: "yellow" },
  { name: "Vert sapin", hex: "#0b5f3c", family: "green" },
  { name: "Vert menthe", hex: "#98d8b1", family: "green" },
  { name: "Vert olive", hex: "#6b8e23", family: "green" },
  { name: "Turquoise", hex: "#30d5c8", family: "cyan" },
  { name: "Bleu ciel", hex: "#66ccff", family: "blue" },
  { name: "Bleu marine", hex: "#0a1f44", family: "blue" },
  { name: "Bleu roi", hex: "#1e3a8a", family: "blue" },
  { name: "Indigo", hex: "#4b0082", family: "purple" },
  { name: "Lavande", hex: "#b57edc", family: "purple" },
  { name: "Prune", hex: "#5d3954", family: "purple" },
  { name: "Rose bonbon", hex: "#ff69b4", family: "pink" },
  { name: "Rose poudré", hex: "#f4c2c2", family: "pink" },
  { name: "Brun terre", hex: "#7b3f00", family: "brown" },
  { name: "Beige", hex: "#e8dcc5", family: "brown" },
  { name: "Chocolat", hex: "#3f2305", family: "brown" },
  { name: "Gris ardoise", hex: "#708090", family: "gray" },
  { name: "Gris perle", hex: "#d3d3d3", family: "gray" },
  { name: "Noir charbon", hex: "#1c1c1c", family: "black" },
  { name: "Blanc cassé", hex: "#f8f4e9", family: "white" },
];
