import type { NextConfig } from "next";

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
};

export default nextConfig;
