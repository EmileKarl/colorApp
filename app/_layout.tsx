import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
