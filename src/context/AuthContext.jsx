import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, displayName, city, wantsToOrganize }) {
    // The profiles row is created automatically by a database trigger
    // (see supabase/schema.sql) once auth.users gets the new account —
    // we just pass the extra fields along as signup metadata for it to use.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          city: city || null,
          wants_to_organize: Boolean(wantsToOrganize),
        },
      },
    });
    return { data, error };
  }

  async function signIn({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function sendPasswordReset(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }

  async function updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword });
  }

  async function signOut() {
    return supabase.auth.signOut();
  }

  // A signed-up user can request organizer status; an admin approves it
  // by flipping role to "organizer" in the admin dashboard.
  async function requestOrganizerRole() {
    if (!session?.user) return { error: new Error("Not signed in") };
    return supabase
      .from("profiles")
      .update({ organizer_requested: true })
      .eq("id", session.user.id);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    requestOrganizerRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
