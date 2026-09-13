import { classifyColor } from "../color-engine/classification/colorMatcher";
import { rgbToLab, labToLch } from "../color-engine/color-spaces/lab";
import { deltaE2000 } from "../color-engine/metrics/deltaE2000";
import { ALL_COLOR_FAMILIES, FAMILY_LABEL_FR, getColorFamily, hexToRgb, isValidHex, normalizeHex } from "../lib/color";
import type { ColorFamily } from "../lib/color";

/**
 * Color search (spec §42, and the achievable half of §43).
 *
 * Handles three kinds of query, decided from the text itself:
 *  - a hex code → perceptual nearest-match, so "#0047AB" finds colors *close*
 *    to that, not just an exact string equality;
 *  - a family or modifier word ("bleu", "chaud", "foncé") → filter;
 *  - a color name → matched against the reference database.
 *
 * Deliberately not implemented: the natural-language cases of §43 ("find me a
 * palette for luxury branding"). Those need a language model, which would mean
 * a network round-trip and an API cost on every search — the spec's §26 and §27
 * both argue against that here, and a keyword search over measured properties
 * covers the realistic queries offline.
 */

export type SearchableColor = {
  hex: string;
  /** Optional label, e.g. a saved color's name. */
  label?: string;
};

export type SearchResult<T extends SearchableColor> = {
  item: T;
  /** Why it matched, for showing the user. */
  reason: string;
  /** Lower is better. Exact/near matches rank first. */
  score: number;
};

/** Modifier words that map onto measurable properties. */
const MODIFIERS: { keywords: string[]; label: string; test: (lch: { L: number; C: number }) => boolean }[] = [
  { keywords: ["clair", "clairs", "light", "pâle", "pale"], label: "clair", test: (lch) => lch.L >= 70 },
  { keywords: ["foncé", "fonce", "sombre", "dark"], label: "foncé", test: (lch) => lch.L <= 35 },
  { keywords: ["vif", "vive", "saturé", "sature", "vibrant"], label: "vif", test: (lch) => lch.C >= 45 },
  { keywords: ["terne", "doux", "pastel", "désaturé", "desature"], label: "doux", test: (lch) => lch.C <= 25 },
  { keywords: ["neutre", "gris", "grey", "gray"], label: "neutre", test: (lch) => lch.C <= 10 },
];

/** Family words in French and English, mapped to the engine's families. */
const FAMILY_KEYWORDS: Record<string, ColorFamily> = {
  rouge: "red", red: "red",
  orange: "orange",
  jaune: "yellow", yellow: "yellow",
  vert: "green", green: "green",
  cyan: "cyan", turquoise: "cyan",
  bleu: "blue", blue: "blue",
  violet: "purple", purple: "purple", mauve: "purple",
  rose: "pink", pink: "pink",
  brun: "brown", brown: "brown", marron: "brown",
  gris: "gray", gray: "gray", grey: "gray",
  noir: "black", black: "black",
  blanc: "white", white: "white",
};

/**
 * Searches a list of colors.
 *
 * @param query Free text. Empty returns everything, unranked.
 * @param items Colors to search.
 * @param limit Maximum results.
 * @returns Matches sorted best-first, each with the reason it matched.
 */
export function searchColors<T extends SearchableColor>(
  query: string,
  items: T[],
  limit = 50,
): SearchResult<T>[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return items.slice(0, limit).map((item) => ({ item, reason: "", score: 0 }));
  }

  // A hex query is a perceptual proximity search, not a string comparison.
  const asHex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (isValidHex(asHex)) {
    const targetLab = rgbToLab(hexToRgb(normalizeHex(asHex)));
    return items
      .map((item) => {
        const distance = deltaE2000(targetLab, rgbToLab(hexToRgb(item.hex)));
        return {
          item,
          score: distance,
          reason: distance < 1 ? "Correspondance exacte" : `À ${distance.toFixed(1)} ΔE00`,
        };
      })
      .filter((entry) => entry.score <= 25)
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);
  }

  const words = trimmed.split(/\s+/);
  const families = words.map((word) => FAMILY_KEYWORDS[word]).filter(Boolean) as ColorFamily[];
  const modifiers = MODIFIERS.filter((modifier) =>
    words.some((word) => modifier.keywords.includes(word)),
  );

  return items
    .map((item) => {
      const rgb = hexToRgb(item.hex);
      const lch = labToLch(rgbToLab(rgb));
      const family = getColorFamily(rgb);
      const reasons: string[] = [];
      let score = 0;

      // Every stated family and modifier must hold — a search for "bleu foncé"
      // that returned light blues would be useless.
      if (families.length > 0) {
        if (!families.includes(family)) return null;
        reasons.push(FAMILY_LABEL_FR[family]);
      }
      for (const modifier of modifiers) {
        if (!modifier.test(lch)) return null;
        reasons.push(modifier.label);
      }

      // Fall back to matching the nearest reference color's name.
      if (families.length === 0 && modifiers.length === 0) {
        const named = classifyColor(rgbToLab(rgb)).best?.reference.name.toLowerCase() ?? "";
        const label = item.label?.toLowerCase() ?? "";
        const hit = words.every((word) => named.includes(word) || label.includes(word));
        if (!hit) return null;
        reasons.push(named || label);
        score = 1;
      }

      return { item, reason: reasons.join(" · "), score };
    })
    .filter((entry): entry is SearchResult<T> => entry !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

/** Suggested queries, offered when the search field is empty. */
export const SEARCH_SUGGESTIONS: string[] = [
  ...ALL_COLOR_FAMILIES.slice(0, 6).map((family) => FAMILY_LABEL_FR[family].toLowerCase()),
  "bleu foncé",
  "vert clair",
  "neutre",
  "vif",
];
