import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import CommandPalette from "@/components/layout/CommandPalette";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Providers from "@/components/layout/Providers";
import { serverApi } from "@/lib/api.server";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import PromoPopup from "@/components/PromoPopup";
import "./globals.css";

const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:8100";

/**
 * The store settings (name, tagline, logo version, time zone), read once per render of the
 * root layout. The fetch is cached and tagged "settings", so pages stay static and a save in
 * Dashboard -> Settings refreshes all of them. If the API is down, the defaults keep the shell up.
 */
const loadSettings = () => serverApi.settings({ cache: "force-cache" }).catch(() => DEFAULT_SETTINGS);

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${s.shop_name} — ${s.tagline || "PC parts"}`,
      template: `%s · ${s.shop_name}`,
    },
    description:
      "Current-generation PC components in rupiah: Core Ultra and Ryzen X3D processors, RTX 50 and RDNA 4 graphics, PCIe 5.0 storage, and a build planner that checks compatibility for you.",
    applicationName: s.shop_name,
    keywords: ["PC parts", "GPU", "CPU", "motherboard", "Indonesia", s.shop_name],
    // the favicon follows the logo set in Dashboard -> Settings (a square SVG variant)
    icons: { icon: [{ url: `/api/settings/logo?variant=icon&v=${s.logo_version}`, type: "image/svg+xml" }] },
    openGraph: {
      type: "website",
      siteName: s.shop_name,
      images: [{ url: "/banners/new-arrivals.avif", width: 2560, height: 1080, alt: s.shop_name }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#060914",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await loadSettings();
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="relative flex min-h-dvh flex-col">
        {/* fixed decorative backdrop: drifting grid + two colour blooms */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="bg-cyber-grid absolute inset-0 animate-grid-drift mask-[radial-gradient(ellipse_at_50%_0%,black_25%,transparent_75%)]" />
          <div className="absolute -top-40 left-1/4 size-144 rounded-full bg-cyan/10 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 size-120 rounded-full bg-magenta/10 blur-[120px]" />
        </div>

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-cyan focus:px-4 focus:py-2 focus:text-void"
        >
          Skip to content
        </a>

        <Providers settings={settings}>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer settings={settings} />
          <CommandPalette />
          <PromoPopup />
        </Providers>
      </body>
    </html>
  );
}
