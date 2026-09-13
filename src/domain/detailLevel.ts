import { labToLch } from "../color-engine/color-spaces/lab";
import { deltaE76 } from "../color-engine/metrics/deltaE76";
import { deltaE94 } from "../color-engine/metrics/deltaE94";
import type { AnalyzeColorResult } from "../color-engine/pipeline/analyzeColor";

/**
 * Detail levels (spec §45).
 *
 * The engine always computes everything; this decides how much of it to show.
 * Hiding data behind a level is a UI concern, not a computation one — the
 * expert view costs nothing extra because the numbers already exist.
 */

export type DetailLevel = "basic" | "advanced" | "expert";

export const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  basic: "Simple",
  advanced: "Avancé",
  expert: "Expert",
};

export type LabRow = { label: string; value: string; hint?: string };
export type LabSection = { title: string; rows: LabRow[] };

/**
 * Turns an analysis into the sections the Color Lab should display.
 *
 * @param result A completed measurement.
 * @param level How much to reveal.
 * @returns Sections in display order. Basic returns identity only; advanced
 * adds perceptual coordinates and confidence; expert adds the raw pipeline
 * internals — image quality, illuminant estimation and estimator agreement.
 */
export function buildLabSections(
  result: AnalyzeColorResult,
  level: DetailLevel,
): LabSection[] {
  const { rgb, hsv, lab, dominantColor } = result;
  const lch = labToLch(lab);

  const sections: LabSection[] = [
    {
      title: "Identité",
      rows: [
        { label: "HEX", value: dominantColor.hex.toUpperCase() },
        { label: "RGB", value: `${rgb.r}, ${rgb.g}, ${rgb.b}` },
        {
          label: "Nom le plus proche",
          value: result.classification?.reference.name ?? "Aucun nom proche",
          hint:
            result.classification !== null
              ? `ΔE00 ${result.deltaE} par rapport à la référence`
              : "Aucune couleur de référence à moins de 25 ΔE00",
        },
      ],
    },
  ];

  if (level === "basic") return sections;

  sections.push({
    title: "Coordonnées perceptuelles",
    rows: [
      {
        label: "HSV",
        value: `${Math.round(hsv.h)}°, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%`,
      },
      {
        label: "CIELAB",
        value: `L* ${lab.L.toFixed(1)}  a* ${lab.a.toFixed(1)}  b* ${lab.b.toFixed(1)}`,
        hint: "Espace perceptuellement uniforme, référence D65",
      },
      {
        label: "LCh",
        value: `L ${lch.L.toFixed(1)}  C ${lch.C.toFixed(1)}  h ${lch.h.toFixed(0)}°`,
        hint: "Forme cylindrique du Lab : chroma et teinte séparés",
      },
      {
        label: "Fiabilité",
        value: `${Math.round(result.confidence * 100)} %  ±${result.uncertainty} ΔE00`,
      },
    ],
  });

  if (level === "advanced") return sections;

  // Expert: the pipeline's own internals, so an advanced user can judge the
  // measurement rather than take it on faith.
  const referenceLab = result.classification?.reference.lab;

  sections.push({
    title: "Métriques de différence",
    rows: referenceLab
      ? [
          { label: "ΔE76", value: deltaE76(lab, referenceLab).toFixed(2) },
          { label: "ΔE94", value: deltaE94(referenceLab, lab).toFixed(2) },
          {
            label: "ΔE2000",
            value: String(result.deltaE),
            hint: "Métrique de décision du moteur",
          },
        ]
      : [{ label: "—", value: "Aucune référence assez proche pour comparer" }],
  });

  sections.push({
    title: "XYZ",
    rows: [
      {
        label: "CIE XYZ",
        value: `${dominantColor.xyz.x.toFixed(3)}  ${dominantColor.xyz.y.toFixed(3)}  ${dominantColor.xyz.z.toFixed(3)}`,
        hint: "Tristimulus, Y = luminance relative",
      },
    ],
  });

  sections.push({
    title: "Qualité d'image",
    rows: [
      { label: "Score", value: result.imageQuality.score.toFixed(2) },
      { label: "Luminosité moyenne", value: `L* ${result.imageQuality.meanLightness.toFixed(1)}` },
      { label: "Contraste", value: result.imageQuality.contrast.toFixed(2) },
      { label: "Bruit estimé", value: `σ ${result.imageQuality.noise.toFixed(2)}` },
      { label: "Netteté", value: result.imageQuality.sharpness.toFixed(1) },
      {
        label: "Écrêtage",
        value: `${(result.imageQuality.clippedHighlights * 100).toFixed(1)}% hautes / ${(result.imageQuality.clippedShadows * 100).toFixed(1)}% basses`,
      },
      {
        label: "Signalements",
        value:
          result.imageQuality.flags.length > 0
            ? result.imageQuality.flags.join(", ")
            : "Aucun",
      },
    ],
  });

  sections.push({
    title: "Éclairage",
    rows: [
      { label: "Méthode", value: result.lighting.method },
      {
        label: "Gains appliqués",
        value: `R ${result.lighting.gains.r.toFixed(2)}  G ${result.lighting.gains.g.toFixed(2)}  B ${result.lighting.gains.b.toFixed(2)}`,
      },
      { label: "Dominante", value: result.lighting.tone },
      { label: "Force", value: result.lighting.castStrength.toFixed(3) },
      {
        label: "Accord des estimateurs",
        value: `${Math.round(result.lighting.agreement * 100)} %`,
        hint: "Sous 35 %, aucune correction n'est appliquée",
      },
    ],
  });

  sections.push({
    title: "Estimateurs",
    rows: result.estimates.map((estimate) => ({
      label: estimate.estimator,
      value: `L* ${estimate.color.L.toFixed(1)}  a* ${estimate.color.a.toFixed(1)}  b* ${estimate.color.b.toFixed(1)}`,
    })),
  });

  sections.push({
    title: "Zone analysée",
    rows: [
      {
        label: "Région",
        value: `${result.region.width}×${result.region.height} px à (${result.region.x}, ${result.region.y})`,
      },
      {
        label: "Couleurs secondaires",
        value: result.colors.length > 0 ? result.colors.map((c) => c.hex).join("  ") : "Aucune",
      },
    ],
  });

  return sections;
}
