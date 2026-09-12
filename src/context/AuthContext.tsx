import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import type { ProfileRow } from "../types/database";

type AuthState = {
  session: Session | null;
  user: User | null;
  /** The current user's public profile row, including their role. Null while loading or signed out. */
  profile: ProfileRow | null;
  /** True once profile.role is 'moderator' or 'admin'. UI convenience only — the real
   * boundary is enforced server-side by the is_moderator() RLS policies, never this flag. */
  isModerator: boolean;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account and all private data (§12). */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Keeps session and profile in sync from one place, so a sign-out
    // clears the profile through the same async path as a sign-in loads
    // it — every setState below runs inside a promise callback, never
    // synchronously in this effect's own body.
    async function syncProfile(nextSession: Session | null) {
      if (!nextSession?.user) {
        if (!cancelled) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextSession.user.id)
        .single();
      if (!cancelled) setProfile((data as ProfileRow | null) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      syncProfile(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      syncProfile(nextSession);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isModerator: profile?.role === "moderator" || profile?.role === "admin",
      loading,
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUpWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      deleteAccount: async () => {
        const { error } = await supabase.rpc("delete_own_account");
        if (error) throw error;
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
