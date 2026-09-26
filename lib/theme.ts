import { isStaff, type Role } from "@/lib/roles";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * Dark / light for the admin area. The storefront is always dark - its product photos and hero
 * banners are composed on the dark panel colour - so the light theme applies only to staff, and
 * only on /dashboard. It is a per-browser preference in localStorage, applied as
 * data-theme="light" on <html>; app/globals.css swaps the colour variables under that attribute.
 */
export type Theme = "dark" | "light";

/** fired on this tab when the theme changes, so every useTheme() hook re-reads it */
export const THEME_EVENT = "revotech:theme-change";

export const isAdminPath = (pathname: string) => pathname === "/dashboard" || pathname.startsWith("/dashboard/");

// used when localStorage is blocked, so the switch still works until the page is reloaded
let unsaved: Theme = "dark";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEYS.theme) === "light" ? "light" : "dark";
  } catch {
    return unsaved;
  }
}

export function saveTheme(theme: Theme) {
  unsaved = theme;
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    // blocked (private mode, site data off): `unsaved` carries it
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Should this page be light? The one rule, shared by the boot script and ThemeSync. */
export const wantsLight = (theme: Theme, role: Role | null | undefined, pathname: string) =>
  theme === "light" && isStaff(role) && isAdminPath(pathname);

/**
 * Runs in <head> before the first paint, so a reload of a light dashboard never flashes dark.
 * Plain ES5 on purpose: it is inlined as text, outside the bundle. Mirrors wantsLight().
 */
export const THEME_BOOT_SCRIPT = `try{var p=location.pathname,u=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEYS.user)})||"null");if(localStorage.getItem(${JSON.stringify(STORAGE_KEYS.theme)})==="light"&&u&&(u.role==="admin"||u.role==="superadmin")&&(p==="/dashboard"||p.indexOf("/dashboard/")===0))document.documentElement.setAttribute("data-theme","light")}catch(e){}`;
