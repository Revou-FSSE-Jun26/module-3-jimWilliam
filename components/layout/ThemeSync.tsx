"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { readTheme, THEME_EVENT, wantsLight, type Theme } from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab switched it
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The staff member's saved theme ("dark" on the server and before hydration). */
export const useTheme = (): Theme => useSyncExternalStore(subscribe, readTheme, () => "dark");

/**
 * Keeps data-theme on <html> right as you move around: light on the dashboard when a staff
 * member chose it, dark everywhere else - including straight after leaving the dashboard or
 * signing out, since <html> survives client-side navigation. The first paint is handled by
 * THEME_BOOT_SCRIPT in the root layout; this takes over once the session is known.
 */
export default function ThemeSync() {
  const pathname = usePathname();
  const { currentUser, isReady } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!isReady) return;
    const root = document.documentElement;
    if (wantsLight(theme, currentUser?.role, pathname)) root.dataset.theme = "light";
    else delete root.dataset.theme;
  }, [isReady, theme, currentUser?.role, pathname]);

  return null;
}
