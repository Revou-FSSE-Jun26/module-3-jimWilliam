import Image from "next/image";
import { cx } from "@/lib/classes";
import { galleryFor } from "@/lib/meta";
import type { Product } from "@/lib/types";

/**
 * Square product tile. Images are pre-encoded AVIF (scripts/fetch-images.mjs) and next/image
 * serves right-sized variants from them; the blur placeholder is a 32px AVIF baked in at
 * build time, so there is no layout shift and no grey box while the real image loads.
 */
export default function ProductImage({
  product,
  sizes = "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw",
  priority = false,
  className,
  dimmed = false,
}: {
  product: Pick<Product, "product_id" | "category_id" | "product_name" | "images">;
  sizes?: string;
  priority?: boolean;
  className?: string;
  dimmed?: boolean;
}) {
  const primary = galleryFor(product)[0];
  return (
    <div className={cx("relative aspect-square overflow-hidden bg-surface", className)}>
      <Image
        src={primary.src}
        alt={product.product_name}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={primary.blurDataURL ? "blur" : "empty"}
        blurDataURL={primary.blurDataURL ?? undefined}
        className={cx("object-cover transition duration-500", dimmed && "opacity-40 grayscale")}
      />
    </div>
  );
}
