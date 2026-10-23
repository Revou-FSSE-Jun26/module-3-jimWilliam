import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * /robots.txt - crawl the storefront, skip the private and per-visitor pages. This only asks
 * crawlers politely: the dashboard is protected by its role checks, and the private pages also
 * carry their own noindex metadata. Product images and the logo stay crawlable even though they
 * are served from under /api/ (the more specific Allow wins).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/images/", "/api/logo"],
      disallow: ["/api/", "/dashboard", "/account", "/cart", "/checkout", "/orders", "/login", "/register"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
