import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Community features (accounts, saved-to-cloud, voting) require a Supabase
 * project. Failing loudly here — instead of silently disabling those
 * features — makes a missing .env.local obvious during development rather
 * than surfacing as a confusing runtime error deep in a screen.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && !__DEV__) {
  // In a production build this should never happen — EAS builds must be
  // configured with the real env vars. Fail fast rather than shipping a
  // build that silently can't reach the backend.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY at build time.",
  );
}

// Note: not parameterized with the Database generic — the pinned
// @supabase/supabase-js version's schema-resolution types didn't accept our
// hand-written schema cleanly. Callers get real types from src/types/database.ts
// instead, applied at the edge in src/lib/*Api.ts (each query result is cast
// to its Row type there). Swap in `supabase gen types typescript` output and
// re-add `createClient<Database>(...)` once a real project exists to get
// end-to-end inference again.
export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
