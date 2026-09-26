import Link from "next/link";
import Brand from "@/components/layout/Brand";
import type { SiteSettings } from "@/lib/settings";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "All products" },
      { href: "/categories", label: "Categories" },
      { href: "/build", label: "Build planner" },
      { href: "/cart", label: "Cart" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Register" },
      { href: "/orders", label: "My orders" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About me" },
      { href: "https://github.com/jim1504/Revou-revoshop-jim1504", label: "Backend API (Module 2)" },
    ],
  },
];

export default function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="relative mt-24 border-t border-line bg-void/80" data-testid="site-footer">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-linear-to-r from-transparent via-magenta/50 to-transparent" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Brand settings={settings} />
          <p className="max-w-xs text-sm leading-relaxed text-dim">
            Current-generation PC parts, priced in rupiah. Processors, boards, memory, graphics, power and peripherals —
            with a build planner that checks the sockets line up before you check out.
          </p>
          {(settings.support_email || settings.support_phone) && (
            <ul className="space-y-1 font-mono text-xs text-dim" data-testid="footer-contact">
              {settings.support_email && (
                <li>
                  <a href={`mailto:${settings.support_email}`} className="hover:text-cyan">
                    {settings.support_email}
                  </a>
                </li>
              )}
              {settings.support_phone && (
                <li>
                  <a href={`tel:${settings.support_phone.replace(/[^\d+]/g, "")}`} className="hover:text-cyan">
                    {settings.support_phone}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="mb-3 font-mono text-[0.68rem] tracking-[0.2em] text-faint uppercase">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-dim transition hover:text-cyan">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 font-mono text-[0.68rem] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {settings.shop_name} · RevoU Module 3
          </p>
          <p>Prices are indicative Indonesian street prices. Product images © their manufacturers.</p>
        </div>
      </div>
    </footer>
  );
}
