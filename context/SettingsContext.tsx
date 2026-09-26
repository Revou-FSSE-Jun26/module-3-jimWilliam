"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_SETTINGS, formatters, type SiteSettings } from "@/lib/settings";

type SettingsValue = SiteSettings & { fmt: ReturnType<typeof formatters> };

const SettingsContext = createContext<SettingsValue>({ ...DEFAULT_SETTINGS, fmt: formatters(DEFAULT_SETTINGS) });

/**
 * The store settings, loaded once by the root layout (a cached, tagged fetch) and handed down
 * here, so client components get the shop name, logo version and date formatting without
 * fetching them again.
 */
export function SettingsProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  const ctx = useMemo(() => ({ ...value, fmt: formatters(value) }), [value]);
  return <SettingsContext value={ctx}>{children}</SettingsContext>;
}

export const useSettings = () => useContext(SettingsContext);
