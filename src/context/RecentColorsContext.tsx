import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Local history of scanned colors.
 *
 * Deliberately device-local and auth-free: scanning must work offline and
 * without an account, and the community/cloud collection is a separate,
 * opt-in concern. This is the storage layer of spec §51, kept small.
 */

export type RecentColor = {
  hex: string;
  /** ISO timestamp of the scan. */
  scannedAt: string;
  /** Measurement confidence, 0–1, when the entry came from an analysis. */
  confidence?: number;
};

const STORAGE_KEY = "colorcode.recentColors.v1";

/** Kept small: this is a quick-access list, not an archive. */
const MAX_ENTRIES = 24;

type RecentColorsState = {
  colors: RecentColor[];
  /** True until the persisted list has been read back. */
  loading: boolean;
  add: (color: RecentColor) => Promise<void>;
  clear: () => Promise<void>;
};

const RecentColorsContext = createContext<RecentColorsState | undefined>(undefined);

export function RecentColorsProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<RecentColor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!cancelled) {
          // Validate rather than trust: a corrupted or older-format entry must
          // not crash the app on launch.
          setColors(Array.isArray(parsed) ? parsed.filter(isRecentColor) : []);
        }
      } catch {
        if (!cancelled) setColors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async (color: RecentColor) => {
    setColors((previous) => {
      // Move an existing hex to the front rather than duplicating it.
      const withoutDuplicate = previous.filter((entry) => entry.hex !== color.hex);
      const next = [color, ...withoutDuplicate].slice(0, MAX_ENTRIES);
      // Persist without blocking the UI update; a failed write only costs
      // history, never the scan itself.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setColors([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<RecentColorsState>(
    () => ({ colors, loading, add, clear }),
    [colors, loading, add, clear],
  );

  return <RecentColorsContext.Provider value={value}>{children}</RecentColorsContext.Provider>;
}

function isRecentColor(value: unknown): value is RecentColor {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.hex === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(candidate.hex) &&
    typeof candidate.scannedAt === "string"
  );
}

export function useRecentColors(): RecentColorsState {
  const context = useContext(RecentColorsContext);
  if (!context) throw new Error("useRecentColors must be used within a RecentColorsProvider");
  return context;
}
