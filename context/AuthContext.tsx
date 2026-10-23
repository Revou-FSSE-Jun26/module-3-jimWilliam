"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT } from "@/lib/api.client";
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
  /** sign in with the API's access token; without one (a profile update) the current token is kept */
  login: (user: User, token?: string) => void;
  logout: () => void;
}

/**
 * What is kept in localStorage: the user plus the Flask API's access token, which
 * lib/api.client.ts sends as `Authorization: Bearer` on every request.
 */
type Session = User & { token: string };

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    // a session without a token (stored before the app used the Flask API) can't call it - sign in again
    return typeof parsed.id === "number" && typeof parsed.email === "string" && typeof parsed.token === "string"
      ? (parsed as Session)
      : null;
  } catch {
    return null;
  }
}

/** The signed-in user without the token - nothing in the UI needs the token itself. */
const userOf = (s: Session | null): User | null => (s ? { id: s.id, username: s.username, email: s.email, role: s.role } : null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Restore the session after a refresh. This has to happen in an effect rather than in the
  // initial state: the server render has no localStorage, and reading it during the first
  // client render would produce a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setCurrentUser(userOf(readSession()));
    setIsReady(true);

    // keep tabs in sync: logging out in one tab logs out the others
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCurrentUser(userOf(readSession()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((user: User, token?: string) => {
    const session: Session = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role ?? "customer",
      token: token ?? readSession()?.token ?? "",
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* private mode - the session just will not survive a refresh */
    }
    setCurrentUser(userOf(session));
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCurrentUser(null);
  }, []);

  // The API answered 401 to a request that carried the token: it has expired (they last a day)
  // or was revoked. Sign out, so the guards send the user to the login page.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

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

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
