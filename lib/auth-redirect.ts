import { isStaff, type Role } from "@/lib/roles";

/** Only follow ?next= to our own pages - never an absolute URL someone slipped into a link. */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/**
 * Where a user goes after signing in or registering. The login/register forms and the
 * PublicOnlyRoute guard all redirect at the same moment, so they must agree on one answer -
 * otherwise whichever runs last wins (the guard used to send everyone to "/", overriding the
 * form's ?next=, so "Login to buy" dumped customers on the home page instead of the product).
 *
 * Staff go to the dashboard; customers go back to where they were, or home.
 */
export function afterLoginPath(role: Role | undefined, next: string | null | undefined): string {
  if (isStaff(role)) return "/dashboard";
  return safeNext(next) ?? "/";
}

/** ?next= from the current URL. Read at call time so pages need no Suspense boundary for it. */
export function currentNext(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}
