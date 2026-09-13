import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { useOnboarding } from "../src/context/OnboardingContext";
import { CAR, SNEAKER, TSHIRT } from "../src/objects/models";
import { applyColor, createProject } from "../src/objects/project";
import { ObjectCanvas } from "../src/objects/renderer/ObjectCanvas";
import { radius, spacing, type, useLayout, useTheme } from "../src/theme";

/**
 * Onboarding — ColorLens page 2.
 *
 * Four screens, with the exact copy the spec specifies. The third one shows
 * the real renderer applying a real color to the real models rather than a
 * stock illustration: the promise of the app is "your color on this object",
 * and showing the actual thing is both more honest and more convincing than a
 * picture of it.
 */

const SLIDES = [
  {
    title: "Capture les couleurs qui t’inspirent",
    description:
      "Utilise ta caméra ou importe une image pour extraire une couleur ou une palette.",
    color: "#c4302b",
  },
  {
    title: "Mélange, explore et crée",
    description:
      "Génère des variantes, ajuste les proportions et invente tes propres couleurs.",
    color: "#0047ab",
  },
  {
    title: "Visualise tes couleurs sur des objets",
    description:
      "Applique tes couleurs à des vêtements, sneakers, voitures, meubles et accessoires.",
    color: "#1e824c",
  },
  {
    title: "Transforme tes idées en créations",
    description: "Enregistre, exporte et partage tes univers colorés.",
    color: "#7a3fbf",
  },
];

const MODELS = [TSHIRT, SNEAKER, CAR, SNEAKER];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, gutter } = useLayout();
  const { complete } = useOnboarding();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const canvasWidth = Math.min(width - gutter * 4, 420);

  const projects = useMemo(
    () =>
      SLIDES.map((slide, position) => {
        const model = MODELS[position];
        return applyColor(createProject(model), model, slide.color);
      }),
    [],
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const finish = () => {
    complete();
    router.replace("/(tabs)");
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.skipRow, { paddingHorizontal: gutter }]}>
        <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
          <Text style={[type.label, { color: theme.subtext }]}>Passer</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {SLIDES.map((slide, position) => (
          <View key={slide.title} style={[styles.slide, { width, paddingHorizontal: gutter }]}>
            <View style={[styles.canvasFrame, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ObjectCanvas
                model={MODELS[position]}
                project={projects[position]}
                width={canvasWidth}
                height={Math.round(canvasWidth * 0.72)}
              />
            </View>
            <Text style={[type.display, styles.centerText, { color: theme.text }]}>
              {slide.title}
            </Text>
            <Text style={[type.body, styles.centerText, { color: theme.subtext }]}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Écran ${index + 1} sur ${SLIDES.length}`}>
        {SLIDES.map((slide, position) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              {
                backgroundColor: position === index ? theme.accent : theme.border,
                width: position === index ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          label={index >= SLIDES.length - 1 ? "Commencer" : "Suivant"}
          onPress={next}
        />
        <PrimaryButton label="Continuer sans compte" variant="ghost" onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipRow: { alignItems: "flex-end", paddingVertical: spacing.sm },
  pager: { flex: 1 },
  slide: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  canvasFrame: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  centerText: { textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md },
  dot: { height: 8, borderRadius: radius.pill },
  footer: { gap: spacing.xs, paddingTop: spacing.sm },
});
