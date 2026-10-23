import { NextResponse, type NextRequest } from "next/server";
import defaultLogo from "@/data/logo.json";
import { backendUrl } from "@/lib/api";
import { TAG } from "@/lib/server/cache-tags";
import { logoSvg, type LogoVector } from "@/lib/server/logo";
import type { SiteSettings } from "@/lib/settings";

// GET /api/logo[?variant=icon][&v=<logo_version>]
// The store logo as SVG we generate ourselves from the vector paths the API stores (null there =
// the default logo in data/logo.json). icon = a square variant, used as the favicon.

async function fromApi<T>(path: string): Promise<T> {
  // tagged "settings": a new logo or glow setting expires it (see app/api/revalidate)
  const res = await fetch(`${backendUrl()}${path}`, { headers: { accept: "application/json" }, next: { tags: [TAG.settings] } });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
  const variant = req.nextUrl.searchParams.get("variant") === "icon" ? "icon" : "full";
  let logo = defaultLogo as LogoVector;
  let version = 0;
  let glow = true;
  try {
    const [stored, settings] = await Promise.all([
      fromApi<{ logo: LogoVector | null; logo_version: number }>("/settings/logo"),
      fromApi<SiteSettings>("/settings"),
    ]);
    logo = stored.logo ?? logo;
    version = stored.logo_version;
    glow = settings.logo_glow;
  } catch {
    // API unreachable: the default logo keeps the header up
  }

  // a URL with the current version can be cached for good; anything else is revalidated
  const versioned = version > 0 && req.nextUrl.searchParams.get("v") === String(version);
  return new NextResponse(logoSvg(logo, { glow, variant }), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}
