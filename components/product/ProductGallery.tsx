"use client";

import Image from "next/image";
import { useState, ViewTransition, type PointerEvent } from "react";
import { cx } from "@/lib/classes";
import { galleryFor } from "@/lib/meta";
import type { Product } from "@/lib/types";

/** How far the hover zoom magnifies. The masters are 1600px, so 2.5x of a ~600px frame stays sharp. */
const ZOOM = 2.5;

/**
 * Product detail gallery: the selected image large, the rest as thumbnails. The large frame
 * keeps the view-transition name the product card uses, so the card's image still morphs into
 * it on navigation - it always opens on the primary image, which is the one the card shows.
 *
 * Hover zoom: with a mouse over the large image, a layer showing the full-resolution master
 * (the 1600px file itself, not the responsive variant on screen) is scaled up and panned to
 * follow the pointer. Touch and pen input are left alone - there is no hover to follow.
 */
export default function ProductGallery({ product, className }: { product: Product; className?: string }) {
  const images = galleryFor(product);
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];
  const dimmed = !product.is_active;
  /** pointer position over the frame in percent, or null when not zooming */
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const follow = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    setZoom({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
  };

  return (
    <div className={cx("space-y-3", className)} data-testid="product-gallery">
      <ViewTransition name={`product-${product.product_id}`} share="morph" default="none">
        <div
          className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border border-line bg-surface"
          onPointerEnter={follow}
          onPointerMove={follow}
          onPointerLeave={() => setZoom(null)}
          data-testid="gallery-frame"
        >
          <Image
            key={current.src}
            src={current.src}
            alt={images.length > 1 ? `${product.product_name} — image ${active + 1} of ${images.length}` : product.product_name}
            fill
            priority={active === 0}
            sizes="(min-width: 1024px) 50vw, 92vw"
            placeholder={current.blurDataURL ? "blur" : "empty"}
            blurDataURL={current.blurDataURL ?? undefined}
            className={cx("animate-rise object-cover", dimmed && "opacity-40 grayscale")}
            data-testid="gallery-main"
          />
          {zoom && (
            <div
              aria-hidden
              className={cx("pointer-events-none absolute inset-0 bg-no-repeat", dimmed && "brightness-50 grayscale")}
              style={{
                backgroundImage: `url("${current.src}")`,
                backgroundSize: `${ZOOM * 100}%`,
                backgroundPosition: `${zoom.x}% ${zoom.y}%`,
              }}
              data-testid="gallery-zoom"
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 bottom-3 hidden rounded-lg bg-void/70 px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-dim uppercase backdrop-blur-sm transition-opacity group-hover:opacity-0 pointer-fine:block"
          >
            ⌕ Hover to zoom
          </span>
        </div>
      </ViewTransition>

      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active ? "true" : undefined}
                className={cx(
                  "relative block aspect-square w-full overflow-hidden rounded-xl border bg-surface transition",
                  i === active ? "border-cyan shadow-[0_0_16px_-4px_var(--color-cyan)]" : "border-line opacity-70 hover:opacity-100"
                )}
                data-testid="gallery-thumb"
              >
                <Image src={img.src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
