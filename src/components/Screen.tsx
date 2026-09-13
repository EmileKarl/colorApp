import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, useLayout, useTheme } from "../theme";

type Props = {
  children: React.ReactNode;
  /**
   * `scroll` wraps content in a ScrollView. Default true: the audit found four
   * screens that clipped their content at large font sizes because they did
   * not scroll.
   */
  scroll?: boolean;
  /** Set false on screens that own the full viewport, such as the camera. */
  padded?: boolean;
  /** Centers content vertically — for empty and error states. */
  center?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  onRefresh?: () => void;
  refreshing?: boolean;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered outside the scroll area, pinned to the bottom above the inset. */
  footer?: React.ReactNode;
};

/**
 * The single screen shell every route sits in.
 *
 * It exists because of three defects the ColorLens audit found, each of which
 * was being re-introduced screen by screen:
 *
 * 1. No `KeyboardAvoidingView` anywhere — the keyboard covered the input on
 *    the sign-in, sign-up, result and collection screens. §13 forbids this
 *    outright ("le clavier ne doit pas masquer les champs").
 * 2. Screens that did not scroll, clipping content at accessibility font sizes.
 * 3. `SafeAreaProvider` was mounted but no screen consumed the insets, so
 *    content could sit under the notch or the home indicator.
 *
 * Fixing them here means a new screen gets all three by default rather than
 * having to remember them.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  center = false,
  edges,
  onRefresh,
  refreshing = false,
  background,
  contentStyle,
  footer,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, maxContentWidth } = useLayout();

  const top = edges?.top === false ? 0 : insets.top;
  const bottom = edges?.bottom === false ? 0 : insets.bottom;

  const inner: StyleProp<ViewStyle> = [
    padded && { paddingHorizontal: gutter, paddingTop: spacing.md, paddingBottom: spacing.lg },
    { width: "100%", maxWidth: maxContentWidth, alignSelf: "center" },
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[center && styles.grow, inner]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, center && styles.centered, inner]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.fill,
        { backgroundColor: background ?? theme.background, paddingTop: top },
      ]}
      // iOS moves the whole view; Android already resizes the window, and
      // applying "padding" there double-counts the keyboard height.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: bottom + spacing.sm,
              paddingHorizontal: gutter,
              backgroundColor: background ?? theme.background,
              borderTopColor: theme.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : (
        <View style={{ height: bottom }} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1, justifyContent: "center" },
  centered: { justifyContent: "center" },
  footer: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
