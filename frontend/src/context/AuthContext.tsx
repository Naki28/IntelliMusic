// AuthContext — Gestion de l'authentification (Google OAuth Emergent + démo)
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, TokenStore } from "../api/client";

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  country?: string;
  deezer_connected: boolean;
  favorite_genres: string[];
  favorite_artists: string[];
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  ready: boolean;
  loginDemo: (username: string, password: string) => Promise<void>;
  exchangeSession: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  setDeezerConnected: (v: boolean) => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Au montage : tente de récupérer l'user depuis le token stocké
  useEffect(() => {
    (async () => {
      try {
        const token = await TokenStore.get();
        if (token) {
          const u = await api<UserProfile>("/auth/me");
          setUser(u);
        }
      } catch {
        await TokenStore.clear();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await api<UserProfile>("/auth/me");
    setUser(u);
  }, []);

  const loginDemo = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await api<{ session_token: string; user: UserProfile }>("/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await TokenStore.set(res.session_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const exchangeSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await api<{ session_token: string; user: UserProfile }>("/auth/session", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
      await TokenStore.set(res.session_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    await TokenStore.clear();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const u = await api<UserProfile>("/profile", { method: "PATCH", body: JSON.stringify(patch) });
    setUser(u);
  }, []);

  const setDeezerConnected = useCallback(async (v: boolean) => {
    await api(v ? "/profile/connect-deezer" : "/profile/disconnect-deezer", { method: "POST" });
    setUser((u) => (u ? { ...u, deezer_connected: v } : u));
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, ready, loginDemo, exchangeSession, logout, refreshUser, updateProfile, setDeezerConnected }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
