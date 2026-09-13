/**
 * Social export formats (spec §23, §29-31).
 *
 * Sizes are the platforms' documented recommendations. Exports are rendered at
 * a fixed aspect ratio on screen and captured at a pixel size derived from it,
 * so a card composed once looks right on every platform without re-layout.
 */

export type SocialFormat = {
  id: string;
  label: string;
  /** Output pixel dimensions. */
  width: number;
  height: number;
  /** width / height, used to lay the preview out on screen. */
  aspectRatio: number;
};

export const SOCIAL_FORMATS: SocialFormat[] = [
  { id: "square", label: "Instagram · Post", width: 1080, height: 1080, aspectRatio: 1 },
  { id: "story", label: "Instagram · Story", width: 1080, height: 1920, aspectRatio: 1080 / 1920 },
  { id: "tiktok", label: "TikTok", width: 1080, height: 1920, aspectRatio: 1080 / 1920 },
  { id: "pinterest", label: "Pinterest", width: 1000, height: 1500, aspectRatio: 1000 / 1500 },
  { id: "landscape", label: "LinkedIn / Facebook", width: 1200, height: 628, aspectRatio: 1200 / 628 },
];

/** Card layouts from spec §24. */
export type TemplateId = "minimal" | "editorial" | "science" | "palette";

export type Template = {
  id: TemplateId;
  label: string;
  description: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "La couleur en pleine surface, nom et code discrets.",
  },
  {
    id: "editorial",
    label: "Éditorial",
    description: "Grande typographie, mise en page magazine.",
  },
  {
    id: "science",
    label: "Color Science",
    description: "Coordonnées colorimétriques et fiabilité de la mesure.",
  },
  {
    id: "palette",
    label: "Palette",
    description: "La couleur et sa palette harmonisée.",
  },
];

export type ExportQuality = "standard" | "high" | "maximum";

/**
 * Maps a quality level to a view-shot compression value.
 *
 * PNG ignores this (it is lossless); it applies when exporting JPEG.
 */
export const EXPORT_QUALITY: Record<ExportQuality, number> = {
  standard: 0.8,
  high: 0.92,
  maximum: 1,
};

export const EXPORT_QUALITY_LABELS: Record<ExportQuality, string> = {
  standard: "Standard",
  high: "Haute",
  maximum: "Maximale",
};
