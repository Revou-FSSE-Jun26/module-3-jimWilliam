import type { NextConfig } from "next";
import { backendUrl } from "./lib/api";
import { PORTFOLIO_URL } from "./lib/site";

const nextConfig: NextConfig = {
  // `next dev` only serves its JavaScript to localhost by default. Opening the dev server
  // from another address - e.g. http://192.168.24.1:8100 on the LAN, or from a phone - gets
  // the HTML but a 403 for every script, so nothing hydrates: no slider, no login button, no
  // clicks. Allow private 192.168.x.x addresses. Dev only; production builds don't check this.
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    // Images are pre-encoded AVIF with pre-generated width variants; the custom loader picks one
    // per srcset entry instead of re-encoding at request time (see lib/image-loader.ts).
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
  // A short link to share: /portfolio → the author's portfolio site. Temporary (307), so browsers
  // don't cache it and the target can change. /about stays here - it carries Checkpoint 1.
  async redirects() {
    return [{ source: "/portfolio", destination: PORTFOLIO_URL, permanent: false }];
  },
  // The backend is the Flask API (BACKEND_URL). The browser calls /api/... on this site and is
  // proxied to the API, so it never makes a cross-origin request and the API needs no CORS.
  // `fallback` runs after every page and route handler - static *and* dynamic - so this app's
  // own /api routes (uploads, images/[file], logo, page scrapers, revalidate) are answered here
  // first; a plain-array rewrite would run before dynamic routes and swallow /api/images/[file].
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backendUrl()}/:path*` }] };
  },
};

export default nextConfig;
