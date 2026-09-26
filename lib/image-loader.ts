"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Custom next/image loader: every image in this app is already an optimised AVIF with
 * pre-generated smaller variants (scripts/gen-variants.mjs, scripts/gen-banners.mjs), so the
 * loader just picks the smallest variant that covers the requested width. No runtime
 * re-encoding, no Image Optimization quota, and the srcset stays fully responsive.
 */
const VARIANTS: { prefix: string; widths: number[]; master: number }[] = [
  { prefix: "/products/", widths: [400, 800, 1600], master: 1600 },
  { prefix: "/banners/", widths: [1280, 2560], master: 2560 },
  // admin uploads, converted to AVIF with the same widths by lib/server/uploads.ts
  { prefix: "/api/images/", widths: [400, 800, 1600], master: 1600 },
];

export default function imageLoader({ src, width }: ImageLoaderProps): string {
  const rule = VARIANTS.find((v) => src.startsWith(v.prefix));
  if (!rule || !src.endsWith(".avif") || src.includes("@")) return src;
  const pick = rule.widths.find((w) => w >= width) ?? rule.master;
  return pick === rule.master ? src : `${src.slice(0, -".avif".length)}@${pick}.avif`;
}
