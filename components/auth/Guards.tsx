"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { afterLoginPath, currentNext } from "@/lib/auth-redirect";
import { can, isStaff, type Permission } from "@/lib/roles";

/**
 * Client-side route guards. The session lives in localStorage, so these can only decide after
 * AuthProvider has read it (isReady) - deciding earlier would bounce a logged-in user to /login
 * on every refresh. Until then they render a neutral placeholder, never the protected content.
 *
 * These decide what a user *sees*. What a user may *do* is decided again by the API, which
 * checks the same permissions from lib/roles.ts (lib/server/auth.ts) - hiding a button is a
 * courtesy, not a lock.
 */

function Holding({ label }: { label: string }) {
  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-32 text-center" role="status" aria-live="polite">
      <span className="size-8 animate-spin rounded-full border-2 border-line border-t-cyan" aria-hidden />
      <p className="mt-4 font-mono text-xs tracking-[0.2em] text-faint uppercase">{label}</p>
    </div>
  );
}

/** Logged-in users only; everyone else is sent to /login and brought back afterwards. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isReady && !isLoggedIn) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isReady, isLoggedIn, router, pathname]);

  if (!isReady || !isLoggedIn) return <Holding label={isReady ? "Redirecting to login" : "Checking session"} />;
  return <>{children}</>;
}

/**
 * One permission, one page. Logged-out users go to /login; a customer goes home; a staff member
 * who simply lacks this one permission (an admin opening Settings) goes back to the dashboard
 * rather than out of it.
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { isLoggedIn, currentUser, isReady } = useAuth();
  const router = useRouter();
  const allowed = isLoggedIn && can(currentUser?.role, permission);

  useEffect(() => {
    if (!isReady || allowed) return;
    if (!isLoggedIn) router.replace("/login");
    else router.replace(isStaff(currentUser?.role) ? "/dashboard" : "/");
  }, [isReady, isLoggedIn, allowed, currentUser, router]);

  if (!isReady || !allowed) return <Holding label={isReady ? "Not allowed — redirecting" : "Checking session"} />;
  return <>{children}</>;
}

/** The dashboard itself: any staff role. Individual pages narrow it with RequirePermission. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn, currentUser, isReady } = useAuth();
  const router = useRouter();
  const allowed = isLoggedIn && isStaff(currentUser?.role);

  useEffect(() => {
    if (!isReady || allowed) return;
    router.replace(isLoggedIn ? "/" : "/login");
  }, [isReady, isLoggedIn, allowed, router]);

  if (!isReady || !allowed) return <Holding label={isReady ? "Staff only — redirecting" : "Checking session"} />;
  return <>{children}</>;
}

/** Login and register: a signed-in user has no business here, so send them on. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn, currentUser, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // same destination the login/register form picks, so the two can never race each other
    if (isReady && isLoggedIn) router.replace(afterLoginPath(currentUser?.role, currentNext()));
  }, [isReady, isLoggedIn, currentUser, router]);

  if (isReady && isLoggedIn) return <Holding label="Already signed in — redirecting" />;
  return <>{children}</>;
}
