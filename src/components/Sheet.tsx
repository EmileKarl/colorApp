import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, type, useLayout, useTheme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Pinned below the scrollable body — for a confirm action. */
  footer?: React.ReactNode;
};

/**
 * Bottom sheet built on React Native's own Modal.
 *
 * A dedicated sheet library (@gorhom/bottom-sheet) is not in Expo Go's
 * bundled modules and would pull in a large dependency for what is, here, a
 * panel that slides up and can be dismissed. The spec's §26 preference for
 * simplicity applies: Modal gives the presentation, the backdrop and the
 * hardware back button behaviour for free.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height, maxContentWidth } = useLayout();

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        {/* Tapping outside dismisses. Marked as a button so screen readers
            announce it rather than treating it as decorative. */}
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              maxHeight: height * 0.88,
              maxWidth: maxContentWidth,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[type.heading, { color: theme.text }]} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={3}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: theme.surfaceAlt },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: {
    width: "100%",
    alignSelf: "center",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: { flexShrink: 1, gap: 2 },
  close: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  footer: { paddingTop: spacing.sm, gap: spacing.sm },
});
