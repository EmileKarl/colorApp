import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SplashView } from "../src/components/SplashView";
import { AuthProvider } from "../src/context/AuthContext";
import {
  OnboardingProvider,
  useOnboarding,
} from "../src/context/OnboardingContext";
import { PreferencesProvider } from "../src/context/PreferencesContext";
import { RecentColorsProvider } from "../src/context/RecentColorsContext";

export default function RootLayout() {
  return (
    // GestureHandlerRootView must wrap everything, including the navigator:
    // gestures registered below an unwrapped tree silently never fire on
    // Android. It is the outermost element for that reason.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OnboardingProvider>
            <PreferencesProvider>
              <RecentColorsProvider>
                <StatusBar style="auto" />
                <RootNavigator />
              </RecentColorsProvider>
            </PreferencesProvider>
          </OnboardingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The navigator, plus the first-launch decision.
 *
 * The splash is rendered here as a view rather than as a route: `(tabs)/index`
 * already owns "/", so an `app/index.tsx` splash would be the same path and
 * collide. Showing it while onboarding state resolves keeps §1's "aucun écran
 * de chargement inutile" — it is on screen for the duration of one AsyncStorage
 * read, not for the duration of an animation.
 */
function RootNavigator() {
  const { seen } = useOnboarding();
  const router = useRouter();

  useEffect(() => {
    if (seen === false) router.replace("/onboarding");
  }, [seen, router]);

  if (seen === null) return <SplashView />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="result"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Résultat",
        }}
      />
      <Stack.Screen
        name="auth/sign-in"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Connexion",
        }}
      />
      <Stack.Screen
        name="auth/sign-up"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Créer un compte",
        }}
      />
      <Stack.Screen
        name="moderation"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Modération",
        }}
      />
      <Stack.Screen
        name="compare"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Comparer",
        }}
      />
      <Stack.Screen
        name="tap"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Choisir une zone",
        }}
      />
      {/* Palettes and the color library left the tab bar when it came down to
          the five tabs of §3. They are reached from Accueil, Créer and Profil
          instead of being deleted. */}
      <Stack.Screen
        name="library/palettes"
        options={{ headerShown: true, title: "Palettes" }}
      />
      <Stack.Screen
        name="library/colors"
        options={{ headerShown: true, title: "Mes couleurs" }}
      />
      <Stack.Screen
        name="library/creations"
        options={{ headerShown: true, title: "Mes créations" }}
      />
      <Stack.Screen
        name="library/collections"
        options={{ headerShown: true, title: "Collections" }}
      />
      <Stack.Screen
        name="collections/[id]"
        options={{ headerShown: true, title: "Collection" }}
      />
      <Stack.Screen
        name="creations/[id]"
        options={{ headerShown: true, title: "Création" }}
      />
      <Stack.Screen
        name="lab"
        options={{ headerShown: true, title: "Color Lab" }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: true, title: "Paramètres" }}
      />
      <Stack.Screen
        name="objects-check"
        options={{ headerShown: true, title: "Vérification du rendu" }}
      />
      <Stack.Screen
        name="objects/index"
        options={{ headerShown: true, title: "Objets" }}
      />
      <Stack.Screen
        name="objects/[id]"
        options={{ headerShown: true, title: "Modèle" }}
      />
      {/* The Studio draws its own top bar (undo, redo, reset), so the
          navigator's header would be a second one stacked above it. */}
      <Stack.Screen name="studio/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="studio/save"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Enregistrer",
        }}
      />
    </Stack>
  );
}
