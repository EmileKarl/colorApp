import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PaletteStrip } from "../../src/components/PaletteStrip";
import { useAuth } from "../../src/context/AuthContext";
import { useRecentColors } from "../../src/context/RecentColorsContext";
import { colorOfTheDay, greeting } from "../../src/domain/colorOfTheDay";
import { readableTextColor } from "../../src/domain/contrast";
import { generatePalette } from "../../src/domain/palette";
import { spacing, useTheme } from "../../src/theme";

/**
 * Home (spec §3).
 *
 * The color content is the hero: the daily color fills a large surface and its
 * own text color is measured against it, so the block stays legible whatever
 * color the day lands on.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: recent } = useRecentColors();

  // Recomputed only when the calendar day changes, not on every render.
  const daily = useMemo(() => colorOfTheDay(), []);
  const dailyPalette = useMemo(() => generatePalette(daily.rgb, "modern", 5), [daily]);
  const dailyText = readableTextColor(daily.rgb);

  const name = profile?.display_name ?? profile?.username ?? null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.text }]}>
          {greeting()}
          {name ? `, ${name}` : ""}
        </Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Découvre, mesure et compose des couleurs.
        </Text>
      </View>

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push({ pathname: "/compare", params: { a: daily.hex } });
        }}
        accessibilityRole="button"
        accessibilityLabel={`Couleur du jour : ${daily.name}, ${daily.hex}`}
        style={[styles.daily, { backgroundColor: daily.hex }]}
      >
        <Text style={[styles.dailyLabel, { color: rgbCss(dailyText) }]}>Couleur du jour</Text>
        <Text style={[styles.dailyName, { color: rgbCss(dailyText) }]}>{daily.name}</Text>
        <Text style={[styles.dailyHex, { color: rgbCss(dailyText) }]}>
          {daily.hex.toUpperCase()}
        </Text>
      </Pressable>

      <PaletteStrip palette={dailyPalette} />

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions rapides</Text>
      <View style={styles.actions}>
        <QuickAction
          icon="scan-outline"
          label="Scanner"
          onPress={() => router.push("/(tabs)/scan")}
          theme={theme}
        />
        <QuickAction
          icon="cube-outline"
          label="Studio"
          onPress={() => router.push("/objects")}
          theme={theme}
        />
        <QuickAction
          icon="color-filter-outline"
          label="Palettes"
          onPress={() => router.push("/library/palettes")}
          theme={theme}
        />
        <QuickAction
          icon="flask-outline"
          label="Lab"
          onPress={() => router.push("/lab")}
          theme={theme}
        />
        <QuickAction
          icon="git-compare-outline"
          label="Comparer"
          onPress={() => router.push("/compare")}
          theme={theme}
        />
      </View>

      {recent.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Couleurs récentes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.recentRow}>
              {recent.map((entry) => (
                <Pressable
                  key={entry.hex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({ pathname: "/objects", params: { hex: entry.hex } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Appliquer ${entry.hex} à un objet`}
                  style={[
                    styles.recentSwatch,
                    { backgroundColor: entry.hex, borderColor: theme.border },
                  ]}
                />
              ))}
            </View>
          </ScrollView>
        </>
      ) : (
        <Text style={[styles.empty, { color: theme.subtext }]}>
          Scanne ta première couleur pour la retrouver ici.
        </Text>
      )}
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Ionicons name={icon} size={22} color={theme.text} />
      <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const rgbCss = (rgb: { r: number; g: number; b: number }) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: 4 },
  greeting: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  daily: { borderRadius: 24, padding: spacing.lg, gap: 2, minHeight: 168, justifyContent: "flex-end" },
  dailyLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  dailyName: { fontSize: 28, fontWeight: "700" },
  dailyHex: { fontSize: 14, fontVariant: ["tabular-nums"] },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: "600" },
  recentRow: { flexDirection: "row", gap: spacing.xs },
  recentSwatch: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.xs,
  },
  empty: { fontSize: 13 },
});
