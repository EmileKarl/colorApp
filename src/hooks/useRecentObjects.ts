import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "colorlens.recent_objects.v1";
const MAX_ENTRIES = 8;

/**
 * The objects the user opened most recently (§9, "récemment utilisés").
 *
 * Local-only and account-free: which mockup you last opened is a convenience,
 * not data worth a round trip or a row. Kept in AsyncStorage so it survives a
 * restart without requiring a login.
 */
export function useRecentObjects() {
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          // Persisted data is untrusted: a partial write or an older format
          // must degrade to "no recents", never crash the library screen.
          setIds(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
        } catch {
          setIds([]);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback((id: string) => {
    setIds((previous) => {
      const next = [id, ...previous.filter((entry) => entry !== id)].slice(0, MAX_ENTRIES);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { recentObjectIds: ids, rememberObject: remember, loaded };
}
