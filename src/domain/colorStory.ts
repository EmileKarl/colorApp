import { FAMILY_LABEL_FR, getColorFamily, hexToRgb } from "../lib/color";
import { ALL_MATERIALS } from "./materials";
import {
  BRIGHTNESS_LABEL_FR,
  SATURATION_LABEL_FR,
  TEMPERATURE_LABEL_FR,
  colorFacts,
} from "./colorFacts";
import { MOOD_LABEL_FR, USE_LABEL_FR, paletteMoods, suggestedUses } from "./paletteMood";

/**
 * Color Story — ColorLens page 16.
 *
 * The spec wants a narrative sheet for a creation: a name, the palette, the
 * style, keywords, a description, recommended materials and uses.
 *
 * It is written **from the measurements**, by assembling sentences out of
 * facts the engine established, and the user can edit every word of it
 * (page 16 requires that). That choice is deliberate. A language model could
 * write something more evocative, but it would also be free to assert things
 * that are not true of this color — and a confident sentence about a color the
 * user measured, which happens to be wrong, is worse than a plainer sentence
 * that is right. A generative version remains possible later behind an
 * explicit consent step (§11), as a separate decision.
 *
 * What this does *not* claim: that a color means anything. There is no colour
 * psychology here, no "blue conveys trust". Those claims are not measurable
 * and vary by culture, so making them would be inventing expertise.
 */

export type ColorStory = {
  /** Suggested title. Editable. */
  title: string;
  /** Two or three sentences describing the palette. Editable. */
  description: string;
  /** The dominant aesthetic reading, from `paletteMoods`. */
  style: string;
  keywords: string[];
  /** Materials whose rendering suits this palette, with the reason. */
  materials: string[];
  uses: string[];
};

/**
 * Builds a story for a palette.
 *
 * @param palette The colors, dominant first.
 * @param objectName Optional: the object the palette was applied to, which
 * makes the title concrete rather than generic.
 */
export function buildColorStory(palette: string[], objectName?: string): ColorStory | null {
  if (palette.length === 0) return null;

  const primary = palette[0];
  const facts = colorFacts(primary);
  const family = getColorFamily(hexToRgb(primary));
  const familyLabel = FAMILY_LABEL_FR[family].toLowerCase();
  const moods = paletteMoods(palette);
  const topMood = moods[0];
  const secondMood = moods[1];

  const temperature = TEMPERATURE_LABEL_FR[facts.temperature].toLowerCase();
  const brightness = BRIGHTNESS_LABEL_FR[facts.brightness].toLowerCase();
  const saturation = SATURATION_LABEL_FR[facts.saturation].toLowerCase();

  const title = objectName
    ? `${capitalize(familyLabel)} ${MOOD_LABEL_FR[topMood.mood].toLowerCase()} — ${objectName}`
    : `${capitalize(familyLabel)} ${MOOD_LABEL_FR[topMood.mood].toLowerCase()}`;

  const sentences: string[] = [];

  sentences.push(
    `Un ${familyLabel} ${temperature === "neutre" ? "neutre" : `de température ${temperature}`}, ` +
      `de luminosité ${brightness} et de saturation ${saturation}.`,
  );

  if (palette.length > 1) {
    const companions = palette.slice(1, 3).map((hex) => {
      const companionFamily = getColorFamily(hexToRgb(hex));
      return FAMILY_LABEL_FR[companionFamily].toLowerCase();
    });
    sentences.push(
      `Associé à ${listFr(companions)}, l'ensemble se lit comme ` +
        `${MOOD_LABEL_FR[topMood.mood].toLowerCase()}` +
        (secondMood && secondMood.score > topMood.score * 0.8
          ? ` avec une nuance ${MOOD_LABEL_FR[secondMood.mood].toLowerCase()}.`
          : "."),
    );
  }

  // The reason is included verbatim so the reading is auditable: the user can
  // see the measurement behind the adjective and disagree with it.
  sentences.push(topMood.reason);

  const materials = recommendedMaterials(facts.saturation, facts.brightness);
  const uses = suggestedUses(palette).map((entry) => USE_LABEL_FR[entry.use]);

  return {
    title,
    description: sentences.join(" "),
    style: MOOD_LABEL_FR[topMood.mood],
    keywords: keywordsFor(familyLabel, facts, topMood.mood),
    materials,
    uses,
  };
}

/**
 * Materials whose rendering suits a color.
 *
 * Grounded in how the renderer actually treats them rather than in taste: a
 * very saturated color loses its chroma on suede and velvet, whose tint
 * shifts pull chroma down hard, while a deep low-chroma color gains from the
 * tight specular of car paint and metal. These are consequences of the
 * material table in `materials.ts`, not opinions.
 */
function recommendedMaterials(
  saturation: ReturnType<typeof colorFacts>["saturation"],
  brightness: ReturnType<typeof colorFacts>["brightness"],
): string[] {
  const wantsGloss = brightness === "dark" || brightness === "very_dark";
  const wantsMatte = saturation === "intense" || saturation === "vivid";

  return ALL_MATERIALS.filter((material) => {
    if (wantsGloss && material.gloss >= 0.4) return true;
    if (wantsMatte && material.gloss <= 0.2 && material.dC > -6) return true;
    // Everything mid-range renders acceptably on a moderate material.
    return !wantsGloss && !wantsMatte && material.gloss > 0.15 && material.gloss < 0.6;
  })
    .slice(0, 4)
    .map((material) => material.label);
}

function keywordsFor(
  familyLabel: string,
  facts: ReturnType<typeof colorFacts>,
  mood: ReturnType<typeof paletteMoods>[number]["mood"],
): string[] {
  const keywords = new Set<string>([
    familyLabel,
    MOOD_LABEL_FR[mood].toLowerCase(),
    TEMPERATURE_LABEL_FR[facts.temperature].toLowerCase(),
  ]);
  if (facts.saturation === "intense" || facts.saturation === "vivid") keywords.add("saturé");
  if (facts.brightness === "very_dark" || facts.brightness === "dark") keywords.add("profond");
  if (facts.brightness === "very_light" || facts.brightness === "light") keywords.add("lumineux");
  if (facts.saturation === "muted" || facts.saturation === "soft") keywords.add("sobre");
  return [...keywords];
}

function listFr(items: string[]): string {
  if (items.length === 0) return "rien";
  if (items.length === 1) return `un ${items[0]}`;
  return `un ${items.slice(0, -1).join(", un ")} et un ${items[items.length - 1]}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
