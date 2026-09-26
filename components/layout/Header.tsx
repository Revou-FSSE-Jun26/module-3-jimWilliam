"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Brand from "@/components/layout/Brand";
import SearchBar from "@/components/product/SearchBar";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useSignOut } from "@/hooks/useSignOut";
import { buttonVariants, cx } from "@/lib/classes";
import { formatIDRCompact } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  /** "customer": signed in and not staff - staff handle orders in Dashboard -> Orders instead */
  show?: "always" | "user" | "customer" | "staff";
}

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/build", label: "Build" },
  { href: "/about", label: "About" },
  { href: "/orders", label: "Orders", show: "customer" },
  { href: "/dashboard", label: "Dashboard", show: "staff" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header() {
  const pathname = usePathname();
  const { currentUser, isLoggedIn, isStaff, isReady } = useAuth();
  const settings = useSettings();
  const { itemCount, total, isReady: cartReady } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // close the mobile menu on navigation (state adjusted during render, not in an effect)
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const visibleNav = NAV.filter(
    (n) =>
      !n.show ||
      n.show === "always" ||
      (n.show === "user" && isLoggedIn) ||
      (n.show === "customer" && isLoggedIn && !isStaff) ||
      (n.show === "staff" && isStaff)
  );

  // come back to the current page after logging in (but not to the auth pages themselves)
  const loginHref = ["/", "/login", "/register"].includes(pathname) ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;

  const onLogout = useSignOut();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-void/75 backdrop-blur-xl" data-testid="site-header">
      {/* neon hairline along the bottom edge */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-cyan/60 to-transparent" aria-hidden />

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center" aria-label={`${settings.shop_name} home`}>
          <Brand settings={settings} />
        </Link>

        <nav aria-label="Primary" className="ml-2 hidden lg:block">
          <ul className="flex items-center gap-1">
            {visibleNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                    className={cx(
                      "relative rounded-lg px-2.5 py-2 text-sm whitespace-nowrap transition",
                      active ? "text-cyan" : "text-dim hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 -bottom-3.25 h-0.5 rounded-full bg-cyan shadow-[0_0_12px_var(--color-cyan)]" aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto hidden min-w-44 flex-1 xl:block xl:max-w-64">
          <Suspense fallback={<div className="h-10 rounded-xl border border-line bg-void/70" />}>
            <HeaderSearch />
          </Suspense>
        </div>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          {/* the cart belongs to a signed-in session: guests see "Login to buy" instead, and signing
              out empties it, so the button (with its count and total) only exists while logged in */}
          {isLoggedIn && (
          <Link
            href="/cart"
            className={cx(
              "relative inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 whitespace-nowrap transition",
              isActive(pathname, "/cart") ? "border-cyan text-cyan" : "border-line text-ink hover:border-cyan"
            )}
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            data-testid="header-cart"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.76L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9.5" cy="20" r="1.3" />
              <circle cx="17.5" cy="20" r="1.3" />
            </svg>
            <span className="hidden font-mono text-xs whitespace-nowrap tabular sm:inline">{cartReady && itemCount > 0 ? formatIDRCompact(total) : "Cart"}</span>
            {cartReady && itemCount > 0 && (
              <span
                className="absolute -top-2 -right-2 grid min-w-5 place-items-center rounded-full bg-magenta px-1 font-mono text-[0.65rem] font-bold text-void shadow-[0_0_14px_var(--color-magenta)]"
                data-testid="cart-count"
              >
                {itemCount}
              </span>
            )}
          </Link>
          )}

          {/* account: from 640px up (it used to appear only above 1024px, so on a laptop at
              125-150% scaling there was no visible way to log in) */}
          <div className="hidden items-center gap-2 sm:flex">
            {!isReady ? (
              <div className="h-9 w-40" aria-hidden />
            ) : isLoggedIn ? (
              <>
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-xl px-1 py-1 text-sm text-dim transition hover:text-ink"
                  data-testid="header-username"
                  title={`${currentUser!.username} — your account`}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-linear-to-br from-cyan to-magenta font-mono text-xs font-bold text-void">
                    {currentUser!.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate text-ink 2xl:inline">{currentUser!.username}</span>
                  {isStaff && (
                    <span className="hidden font-mono text-[0.6rem] tracking-widest text-magenta uppercase 2xl:inline" data-testid="header-role">
                      {ROLE_LABEL[currentUser!.role ?? "customer"]}
                    </span>
                  )}
                </Link>
                <button type="button" onClick={onLogout} className={cx(buttonVariants.ghost, "whitespace-nowrap")} data-testid="logout">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href={loginHref} className={cx(buttonVariants.secondary, "px-4 py-2")} data-testid="header-login">
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Log in
                </Link>
                <Link href="/register" className={cx(buttonVariants.primary, "hidden px-4 py-2 md:inline-flex")} data-testid="register-link">
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-line text-dim lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              {menuOpen ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-line bg-void/95 px-4 pt-3 pb-5 backdrop-blur-xl lg:hidden">
          <div>
            <Suspense fallback={null}>
              <HeaderSearch />
            </Suspense>
          </div>
          <nav aria-label="Mobile" className="mt-3">
            <ul className="grid gap-1">
              {visibleNav.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "block rounded-lg px-3 py-2.5 text-sm",
                        active ? "bg-cyan/10 text-cyan" : "text-dim hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
            {isLoggedIn ? (
              <>
                <Link href="/account" className="text-sm text-ink hover:text-cyan">
                  {currentUser!.username}
                </Link>
                <button type="button" onClick={onLogout} className={cx(buttonVariants.ghost, "ml-auto")}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={cx(buttonVariants.secondary, "flex-1")}>
                  Log in
                </Link>
                <Link href="/register" className={cx(buttonVariants.primary, "flex-1")}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/** Enter navigates to /products?search=… from any page; on /products it shows the current query. */
function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/products" ? (searchParams.get("search") ?? "") : "";

  const [value, setValue] = useState(current);
  const [seen, setSeen] = useState(current);
  if (current !== seen) {
    setSeen(current);
    setValue(current);
  }

  return (
    <SearchBar
      id="header-search"
      compact
      value={value}
      onChange={setValue}
      onSubmit={(q) => router.push(q ? `/products?search=${encodeURIComponent(q)}` : "/products")}
      placeholder="Search parts…   Ctrl K for everything"
    />
  );
}
