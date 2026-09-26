"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Custom next/image loader: every image in this app is already an optimised AVIF with
 * pre-generated smaller variants (scripts/gen-variants.mjs, scripts/gen-banners.mjs), so the
 * loader just picks the smallest variant that covers the requested width. No runtime
 * re-encoding, no Image Optimization quota, and the srcset stays fully responsive.
 */
const VARIANTS: { match: RegExp; widths: number[]; master: number }[] = [
  { match: /^\/products\//, widths: [400, 800, 1600], master: 1600 },
  { match: /^\/banners\//, widths: [1280, 2560], master: 2560 },
  // admin uploads, converted to AVIF with the same widths by lib/server/uploads.ts - served by
  // /api/images locally, straight from the Vercel Blob CDN in production
  { match: /^(?:\/api\/images\/|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/)/, widths: [400, 800, 1600], master: 1600 },
];

export default function imageLoader({ src, width }: ImageLoaderProps): string {
  const rule = VARIANTS.find((v) => v.match.test(src));
  if (!rule || !src.endsWith(".avif") || src.includes("@")) return src;
  const pick = rule.widths.find((w) => w >= width) ?? rule.master;
  return pick === rule.master ? src : `${src.slice(0, -".avif".length)}@${pick}.avif`;
}
