import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/context/AuthContext";
import { RecentColorsProvider } from "../src/context/RecentColorsContext";

export default function RootLayout() {
  return (
    // GestureHandlerRootView must wrap everything, including the navigator:
    // gestures registered below an unwrapped tree silently never fire on
    // Android. It is the outermost element for that reason.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RecentColorsProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="result"
                options={{ presentation: "modal", headerShown: true, title: "Résultat" }}
              />
              <Stack.Screen
                name="auth/sign-in"
                options={{ presentation: "modal", headerShown: true, title: "Connexion" }}
              />
              <Stack.Screen
                name="auth/sign-up"
                options={{ presentation: "modal", headerShown: true, title: "Créer un compte" }}
              />
              <Stack.Screen
                name="moderation"
                options={{ presentation: "modal", headerShown: true, title: "Modération" }}
              />
              <Stack.Screen
                name="compare"
                options={{ presentation: "modal", headerShown: true, title: "Comparer" }}
              />
              <Stack.Screen
                name="tap"
                options={{ presentation: "modal", headerShown: true, title: "Choisir une zone" }}
              />
              {/* Palettes and the color library left the tab bar when it came
                  down to the five tabs of §3. They are reached from Accueil,
                  Créer and Profil instead of being deleted. */}
              <Stack.Screen
                name="library/palettes"
                options={{ headerShown: true, title: "Palettes" }}
              />
              <Stack.Screen
                name="library/colors"
                options={{ headerShown: true, title: "Mes couleurs" }}
              />
              <Stack.Screen
                name="objects-check"
                options={{ headerShown: true, title: "Vérification du rendu" }}
              />
            </Stack>
          </RecentColorsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
