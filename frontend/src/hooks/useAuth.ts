import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { featureFlags } from "../config/featureFlags";
import { apiUrl } from "../lib/api/url";

export type ExperienceLevel = "student" | "fresher" | "experienced";

export interface UserProfile {
  target_role?: string;
  experience_level?: ExperienceLevel;
  skills: string[];
  github_url?: string;
  resume_url?: string;
  resume_filename?: string;
  resume_text?: string;
}

export interface User {
  id?: string;
  sub: string;
  email: string;
  name: string;
  ai_credits?: number;
  profile?: UserProfile;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<boolean>;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<boolean>;
  deleteAccount: (confirmation: string) => Promise<{ success: boolean; error?: string }>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!featureFlags.enableAuth) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const loadedUser = data.user ?? null;
        setUser(loadedUser);
        if (loadedUser) {
          localStorage.setItem("prepamigo_has_session", "true");
        } else {
          localStorage.removeItem("prepamigo_has_session");
        }
        return loadedUser;
      } else {
        setUser(null);
        localStorage.removeItem("prepamigo_has_session");
        return null;
      }
    } catch (err) {
      console.warn("[Auth] Failed to load session:", err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const updateProfile = useCallback(async (profileData: Partial<UserProfile>): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl("/api/auth/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profileData),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else if (data.profile) {
        setUser((prev) => (prev ? { ...prev, profile: data.profile } : null));
      }
      return true;
    } catch (err) {
      console.error("[Auth] Failed to update profile:", err);
      return false;
    }
  }, []);

  const deleteAccount = useCallback(async (confirmation: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(apiUrl("/api/auth/account"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmation }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to delete account" };
      }

      if (user) {
        sessionStorage.removeItem(`prepamigo_onboarding_skipped_${user.id || user.sub}`);
      }
      sessionStorage.removeItem("prepamigo_onboarding_skipped");
      sessionStorage.clear();
      localStorage.removeItem("prepamigo_app_preferences");
      setUser(null);
      return { success: true };
    } catch (err: any) {
      console.error("[Auth] Delete account failed:", err);
      return { success: false, error: err.message || "Failed to delete account" };
    }
  }, [user]);

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });

      if (user) {
        sessionStorage.removeItem(`prepamigo_onboarding_skipped_${user.id || user.sub}`);
      }
      sessionStorage.removeItem("prepamigo_onboarding_skipped");
      localStorage.removeItem("prepamigo_has_session");
      setUser(null);
      return res.ok;
    } catch (err) {
      console.error("[Auth] Logout failed:", err);
      setUser(null);
      return false;
    }
  }, [user]);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        loading,
        setUser,
        refreshUser,
        logout,
        updateProfile,
        deleteAccount,
      },
    },
    children
  );
}


export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
