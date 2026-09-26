"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can, isStaff, type Permission } from "@/lib/roles";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { User } from "@/lib/types";

const STORAGE_KEY = STORAGE_KEYS.user;
/** Exported so the cart can tell whether a session exists while both contexts are hydrating. */
export const USER_STORAGE_KEY = STORAGE_KEY;

interface AuthContextValue {
  currentUser: User | null;
  isLoggedIn: boolean;
  /** has a dashboard: admin or superadmin */
  isStaff: boolean;
  /** shorthand for "may manage the catalogue" - the check most admin UI needs */
  isAdmin: boolean;
  /** what this user may do; the API re-checks the same permission (lib/roles.ts) */
  can: (permission: Permission) => boolean;
  /** false until localStorage has been read - guards must wait for it or a refresh logs you out */
  isReady: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    return typeof parsed.id === "number" && typeof parsed.email === "string" ? (parsed as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Restore the session after a refresh. This has to happen in an effect rather than in the
  // initial state: the server render has no localStorage, and reading it during the first
  // client render would produce a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setCurrentUser(readStoredUser());
    setIsReady(true);

    // keep tabs in sync: logging out in one tab logs out the others
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCurrentUser(readStoredUser());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((user: User) => {
    const stored: User = { id: user.id, username: user.username, email: user.email, role: user.role ?? "customer" };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* private mode - the session just will not survive a refresh */
    }
    setCurrentUser(stored);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCurrentUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isLoggedIn: currentUser !== null,
      isStaff: isStaff(currentUser?.role),
      isAdmin: can(currentUser?.role, "products:write"),
      can: (permission: Permission) => can(currentUser?.role, permission),
      isReady,
      login,
      logout,
    }),
    [currentUser, isReady, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
