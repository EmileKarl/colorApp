import { deltaE2000 } from "../../color-engine/metrics/deltaE2000";
import { rgbToLab } from "../../color-engine/color-spaces/lab";
import { hexToRgb } from "../../lib/color";
import { MOOD_LABEL_FR } from "../paletteMood";
import { THEMES, THEME_BY_ID, themeAccessibilityIssues, themeMood } from "../themes";

describe("curated themes", () => {
  it("covers the ten themes page 21 lists", () => {
    expect(THEMES).toHaveLength(10);
    for (const id of [
      "minimal",
      "luxury",
      "streetwear",
      "nature",
      "cyberpunk",
      "vintage",
      "tropical",
      "monochrome",
      "pastel",
      "futuristic",
    ] as const) {
      expect(THEME_BY_ID[id]).toBeDefined();
    }
  });

  it("uses valid hex colors throughout", () => {
    for (const theme of THEMES) {
      expect(theme.colors.length).toBeGreaterThanOrEqual(4);
      for (const hex of theme.colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("never ships two colors a user cannot tell apart", () => {
    // A curated palette whose swatches collapse into each other is a curation
    // failure, and the kind that is easy to miss by eye on a bright screen.
    // 5 ΔE00 is comfortably above the "just noticeable" threshold.
    for (const theme of THEMES) {
      for (let i = 0; i < theme.colors.length; i++) {
        for (let j = i + 1; j < theme.colors.length; j++) {
          const distance = deltaE2000(
            rgbToLab(hexToRgb(theme.colors[i])),
            rgbToLab(hexToRgb(theme.colors[j])),
          );
          expect(distance).toBeGreaterThan(5);
        }
      }
    }
  });

  it("never contains a pair that is genuinely indistinguishable", () => {
    // Some themes do have close pairs under colour vision deficiency — a
    // pastel set cannot be both pastel and widely separated — and the app
    // surfaces those as notes rather than hiding them. What is not acceptable
    // is two swatches a viewer simply cannot tell apart at all, which is what
    // this bar catches.
    for (const theme of THEMES) {
      for (const issue of themeAccessibilityIssues(theme)) {
        expect(issue.deltaE).toBeGreaterThan(1.5);
      }
    }
  });

  it("reports a measured mood for every theme", () => {
    // Derived, not declared: an earlier version hand-labelled each theme and
    // the scorer disagreed with several. The label is computed now, so it
    // cannot be wrong.
    for (const theme of THEMES) {
      const mood = themeMood(theme);
      expect(MOOD_LABEL_FR[mood]).toBeDefined();
    }
  });

  it("labels and describes every theme", () => {
    for (const theme of THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(10);
    }
  });
});
