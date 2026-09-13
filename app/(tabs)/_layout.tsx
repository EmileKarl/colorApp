import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View, type ColorValue } from "react-native";

import { radius, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

/**
 * The central "Créer" tab is rendered as a filled disc rather than a plain
 * glyph — §3 asks for a central + / Créer button, and giving it the same
 * weight as the other four would leave the app's primary action
 * indistinguishable from navigation.
 */
function CreateIcon({ focused }: { focused: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.createButton, { backgroundColor: theme.accent, opacity: focused ? 1 : 0.9 }]}>
      <Ionicons name="add" color={theme.onAccent} size={24} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    // Five tabs, per §3. The previous seven truncated their labels on a
    // 375 pt screen, which §13 lists as a defect; Palettes, Collection and
    // Communauté moved into Explorer and Profil rather than being removed.
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subtext,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "scan" : "scan-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Créer",
          tabBarIcon: ({ focused }) => <CreateIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explorer",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? "compass" : "compass-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
