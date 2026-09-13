import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "colorlens.onboarding.v1";

type OnboardingState = {
  /** Null while still reading storage — the splash waits on this. */
  seen: boolean | null;
  complete: () => void;
};

const OnboardingContext = createContext<OnboardingState>({ seen: null, complete: () => undefined });

/**
 * Whether the user has been through onboarding — ColorLens page 2.
 *
 * Stored locally rather than on the profile: onboarding is about this install,
 * not this account, and §2 explicitly allows continuing without an account at
 * all. Tying it to a row would mean a signed-out user saw it forever.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!cancelled) setSeen(value === "done");
      })
      .catch(() => {
        // Storage unavailable: show onboarding rather than blocking the app.
        if (!cancelled) setSeen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(STORAGE_KEY, "done").catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ seen, complete }), [seen, complete]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  return useContext(OnboardingContext);
}
