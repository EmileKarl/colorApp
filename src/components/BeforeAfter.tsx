import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { radius, spacing, type, useTheme } from "../theme";

type Props = {
  before: React.ReactNode;
  after: React.ReactNode;
  width: number;
  height: number;
  beforeLabel?: string;
  afterLabel?: string;
};

const HANDLE_WIDTH = 3;
const KNOB_SIZE = 34;

/**
 * Before/after comparison slider — ColorLens page 17.
 *
 * Both views are rendered at full size and stacked; the top one is revealed by
 * an animated width with `overflow: hidden`. Rendering the "after" clipped
 * rather than cross-fading is what makes the comparison honest — at any handle
 * position the user sees each version at its true colors, where a fade would
 * show a blend of the two that neither version actually is.
 *
 * The gesture runs on the UI thread through Reanimated, so dragging stays
 * smooth even while the JS thread is busy re-rendering the Studio.
 */
export function BeforeAfter({
  before,
  after,
  width,
  height,
  beforeLabel = "Avant",
  afterLabel = "Après",
}: Props) {
  const theme = useTheme();
  const position = useSharedValue(width / 2);
  const start = useSharedValue(width / 2);

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = position.value;
    })
    .onUpdate((event) => {
      const next = start.value + event.translationX;
      position.value = Math.min(width, Math.max(0, next));
    })
    .onEnd(() => {
      // Snap to the edges when released near them, so "show me only the
      // after" is a flick rather than a careful drag to the exact pixel.
      if (position.value < width * 0.08) position.value = withSpring(0);
      else if (position.value > width * 0.92) position.value = withSpring(width);
    });

  const revealStyle = useAnimatedStyle(() => ({ width: position.value }));
  const handleStyle = useAnimatedStyle(() => ({ left: position.value - HANDLE_WIDTH / 2 }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { width, height }]} accessibilityRole="adjustable">
        <View style={StyleSheet.absoluteFill}>{after}</View>

        <Animated.View style={[styles.reveal, { height }, revealStyle]}>
          {/* Fixed width on the inner view so the content does not reflow as
              the mask narrows — it must be clipped, not squeezed. */}
          <View style={{ width, height }}>{before}</View>
        </Animated.View>

        <Animated.View
          style={[styles.handle, { height, backgroundColor: theme.surface }, handleStyle]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.knob,
              { backgroundColor: theme.surface, borderColor: theme.border, top: height / 2 - KNOB_SIZE / 2 },
            ]}
          >
            <Text style={[type.caption, { color: theme.text }]}>◂ ▸</Text>
          </View>
        </Animated.View>

        <View style={[styles.tag, styles.tagLeft, { backgroundColor: theme.overlay }]} pointerEvents="none">
          <Text style={[type.caption, { color: "#ffffff" }]}>{beforeLabel}</Text>
        </View>
        <View style={[styles.tag, styles.tagRight, { backgroundColor: theme.overlay }]} pointerEvents="none">
          <Text style={[type.caption, { color: "#ffffff" }]}>{afterLabel}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: radius.lg },
  reveal: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  handle: { position: "absolute", top: 0, width: HANDLE_WIDTH },
  knob: {
    position: "absolute",
    left: -(KNOB_SIZE - HANDLE_WIDTH) / 2,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    position: "absolute",
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagLeft: { left: spacing.sm },
  tagRight: { right: spacing.sm },
});
