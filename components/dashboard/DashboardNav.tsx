"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/lib/classes";
import type { Permission } from "@/lib/roles";

const TABS: { href: string; label: string; permission: Permission }[] = [
  { href: "/dashboard", label: "Products", permission: "products:write" },
  { href: "/dashboard/categories", label: "Categories", permission: "categories:write" },
  { href: "/dashboard/orders", label: "Orders", permission: "orders:manage" },
  { href: "/dashboard/users", label: "Users", permission: "users:manage" },
  { href: "/dashboard/settings", label: "Settings", permission: "settings:write" },
];

/**
 * Dashboard sub-navigation, showing only the tabs this role may open - an admin has no Users or
 * Settings tab. Hidden entirely from anyone who is not staff, even during a redirect.
 */
export default function DashboardNav() {
  const pathname = usePathname();
  const { isStaff, can } = useAuth();
  const tabs = TABS.filter((t) => can(t.permission));
  if (!isStaff) return null;

  return (
    <nav aria-label="Dashboard" className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/60 p-1.5">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-xl px-4 py-2 font-mono text-xs tracking-[0.12em] whitespace-nowrap uppercase transition",
              active ? "bg-cyan text-void shadow-[0_0_20px_-4px_var(--color-cyan)]" : "text-dim hover:bg-surface-2 hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
