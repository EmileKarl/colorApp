import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { radius, spacing, type, useTheme } from "../theme";

/**
 * Splash — ColorLens page 1.
 *
 * The animation the spec asks for: a point of color that fans into a palette
 * and settles into a strip. It is a *view*, not a route, and it is shown only
 * while the app reads whether onboarding has been seen — typically a few
 * milliseconds. §1 forbids an unnecessary loading screen, so nothing waits on
 * the animation finishing.
 *
 * A route would also have collided: `app/(tabs)/index.tsx` already resolves to
 * "/", and a second `app/index.tsx` is the same path.
 */

const PALETTE = ["#c4302b", "#e8730c", "#f2c200", "#1e824c", "#0047ab"];

export function SplashView() {
  const theme = useTheme();

  const spread = useSharedValue(0);
  const settle = useSharedValue(0);

  useEffect(() => {
    spread.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    settle.value = withDelay(400, withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) }));
  }, [spread, settle]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.row}>
        {PALETTE.map((hex, index) => (
          <Dot key={hex} hex={hex} index={index} spread={spread} settle={settle} />
        ))}
      </View>
      <Text style={[type.display, { color: theme.text }]}>ColorLens</Text>
      <Text style={[type.body, styles.slogan, { color: theme.subtext }]}>
        Une couleur. Des milliers de possibilités.
      </Text>
    </View>
  );
}

function Dot({
  hex,
  index,
  spread,
  settle,
}: {
  hex: string;
  index: number;
  spread: SharedValue<number>;
  settle: SharedValue<number>;
}) {
  const offset = (index - 2) * 34;

  const style = useAnimatedStyle(() => ({
    // The dots start stacked as one point, fan out into a palette, then flatten
    // into a strip — the "point de couleur → palette → objet" of §1.
    transform: [
      { translateX: offset * spread.value },
      { scale: 1 - settle.value * 0.15 },
    ],
    borderRadius: 16 - settle.value * 11,
    width: 32 + settle.value * 12,
    opacity: 0.4 + spread.value * 0.6,
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: hex }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  row: { flexDirection: "row", height: 40, alignItems: "center", marginBottom: spacing.lg },
  dot: { position: "absolute", height: 32, borderRadius: radius.pill },
  slogan: { textAlign: "center", paddingHorizontal: spacing.xl },
});
