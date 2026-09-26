"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/dashboard/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/lib/classes";
import { ROLE_LABEL, type Permission } from "@/lib/roles";

/** `icon` is the path data of a 24x24 stroke icon */
const TABS: { href: string; label: string; permission: Permission; icon: string }[] = [
  { href: "/dashboard", label: "Products", permission: "products:write", icon: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8" },
  { href: "/dashboard/categories", label: "Categories", permission: "categories:write", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/dashboard/orders", label: "Orders", permission: "orders:manage", icon: "M6 2h12v20l-3-2-3 2-3-2-3 2V2ZM9 7h6M9 11h6M9 15h4" },
  { href: "/dashboard/users", label: "Users", permission: "users:manage", icon: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
  { href: "/dashboard/settings", label: "Settings", permission: "settings:write", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" },
];

/**
 * Dashboard navigation, showing only the tabs this role may open - an admin has no Users or
 * Settings tab. A vertical sidebar from lg up; on smaller screens the same links scroll
 * sideways above the page, so the content keeps the full width. The theme switch sits under
 * the tabs. Hidden entirely from anyone who is not staff, even during a redirect.
 */
export default function DashboardNav() {
  const pathname = usePathname();
  const { isStaff, can, currentUser } = useAuth();
  const tabs = TABS.filter((t) => can(t.permission));
  if (!isStaff) return null;

  return (
    <aside className="mb-6 lg:mb-0" data-testid="dashboard-sidebar">
      <div className="flex flex-col gap-3 lg:sticky lg:top-24">
        <p className="hidden px-3 font-mono text-[0.65rem] tracking-[0.2em] text-faint uppercase lg:block">
          {currentUser?.role ? ROLE_LABEL[currentUser.role] : "Admin"} · Dashboard
        </p>
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/60 p-1.5 lg:flex-col lg:overflow-visible lg:p-2">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2.5 rounded-xl px-4 py-2 font-mono text-xs tracking-[0.12em] whitespace-nowrap uppercase transition lg:px-3 lg:py-2.5",
                  active ? "bg-cyan text-void shadow-[0_0_20px_-4px_var(--color-cyan)]" : "text-dim hover:bg-surface-2 hover:text-ink"
                )}
              >
                <svg viewBox="0 0 24 24" className="hidden size-4 shrink-0 lg:block" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </aside>
  );
}
