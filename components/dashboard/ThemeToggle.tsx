"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/layout/ThemeSync";
import { cx } from "@/lib/classes";
import { saveTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: "dark",
    label: "Dark",
    icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
];

/** Dark / light switch for the dashboard, remembered in this browser (see lib/theme.ts). */
export default function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <div role="group" aria-label="Dashboard theme" className={cx("flex gap-1 rounded-xl border border-line bg-surface/60 p-1", className)} data-testid="theme-toggle">
      {OPTIONS.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => saveTheme(o.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[0.7rem] tracking-[0.12em] uppercase transition",
              on ? "bg-surface-3 text-ink" : "text-dim hover:text-ink"
            )}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {o.icon}
            </svg>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
