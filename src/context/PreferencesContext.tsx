import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "colorlens.preferences.v1";

export type Preferences = {
  /** Tint the interface with the most recently captured color (§5). */
  dynamicTheme: boolean;
  /** Transitions and animated transitions. Off is the reduced-motion path. */
  animations: boolean;
  /** Finer object rendering; off for devices where the preview stutters. */
  highQualityRender: boolean;
  /** Keep images on the device: nothing is uploaded (§11). */
  localOnly: boolean;
  /**
   * Consent for generative suggestions (§11).
   *
   * Always false today, and the settings row is disabled: no text is sent
   * anywhere, and the descriptions the app shows are computed on device. The
   * flag exists so that turning the feature on later is an explicit opt-in
   * rather than a silent default.
   */
  aiConsent: boolean;
};

const DEFAULTS: Preferences = {
  dynamicTheme: true,
  animations: true,
  highQualityRender: true,
  localOnly: false,
  aiConsent: false,
};

type PreferencesState = Preferences & {
  setDynamicTheme: (value: boolean) => void;
  setAnimations: (value: boolean) => void;
  setHighQualityRender: (value: boolean) => void;
  setLocalOnly: (value: boolean) => void;
  setAiConsent: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesState>({
  ...DEFAULTS,
  setDynamicTheme: () => undefined,
  setAnimations: () => undefined,
  setHighQualityRender: () => undefined,
  setLocalOnly: () => undefined,
  setAiConsent: () => undefined,
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const stored = JSON.parse(raw) as Partial<Preferences>;
          // Merged over the defaults rather than used directly: a preference
          // added in a later version must not be undefined for existing users.
          setPreferences({ ...DEFAULTS, ...stored });
        } catch {
          // Corrupt value: the defaults are a correct app, so nothing to do.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesState>(
    () => ({
      ...preferences,
      setDynamicTheme: (dynamicTheme) => update({ dynamicTheme }),
      setAnimations: (animations) => update({ animations }),
      setHighQualityRender: (highQualityRender) => update({ highQualityRender }),
      setLocalOnly: (localOnly) => update({ localOnly }),
      setAiConsent: (aiConsent) => update({ aiConsent }),
    }),
    [preferences, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesState {
  return useContext(PreferencesContext);
}
