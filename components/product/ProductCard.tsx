"use client";

import Link from "next/link";
import { useState, ViewTransition } from "react";
import AddToCartButton from "@/components/product/AddToCartButton";
import ProductImage from "@/components/product/ProductImage";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import QuantityCounter from "@/components/ui/QuantityCounter";
import StockMeter from "@/components/ui/StockMeter";
import { useCart } from "@/context/CartContext";
import { cx } from "@/lib/classes";
import { availabilityOf, formatIDR, specText } from "@/lib/format";
import { metaFor } from "@/lib/meta";
import type { Product } from "@/lib/types";

export interface ProductCardProps {
  product: Product;
  /** category label above the name; omitted when not supplied */
  categoryName?: string;
  showDescription?: boolean;
  showStock?: boolean;
  showQuantity?: boolean;
  /** eager-load the image - for cards above the fold */
  priority?: boolean;
  /** stagger index for the entrance animation */
  index?: number;
  /** display only - no quantity or add-to-cart controls (used on the home page) */
  readOnly?: boolean;
}

export default function ProductCard({
  product,
  categoryName,
  showDescription = true,
  showStock = true,
  showQuantity = true,
  priority = false,
  index = 0,
  readOnly = false,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const { quantityOf } = useCart();

  const meta = metaFor(product);
  const availability = availabilityOf(product);
  const inCart = quantityOf(product.product_id);
  const purchasable = availability === "in-stock" || availability === "low-stock";
  const maxQty = Math.max(1, product.stock_quantity - inCart);
  const href = `/products/${product.product_id}`;

  return (
    <Card
      as="article"
      interactive
      accent={meta.accent}
      className="group flex animate-rise flex-col"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      data-testid="product-card"
    >
      {/* decorative duplicate of the title link below: hidden from assistive tech and the tab
          order so each card is a single stop, while mouse users can still click the picture */}
      <Link href={href} className="relative block p-3 pb-0" tabIndex={-1} aria-hidden>
        {/* same name + share on the detail page hero: the image morphs between the two */}
        <ViewTransition name={`product-${product.product_id}`} share="morph" default="none">
          <ProductImage
            product={product}
            priority={priority}
            dimmed={!product.is_active}
            className="rounded-xl transition duration-500 group-hover:scale-[1.02]"
          />
        </ViewTransition>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between p-2.5">
          <AvailabilityBadge availability={availability} className="backdrop-blur-md" />
          {inCart > 0 && (
            <Badge tone="cyan" className="backdrop-blur-md">
              In cart ×{inCart}
            </Badge>
          )}
        </div>

        {!product.is_active && (
          <div className="absolute inset-3 bottom-0 grid place-items-center rounded-xl">
            <span className="clip-hud border border-line-bright bg-void/80 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-dim">
              Not for sale
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
        <div className="flex items-center justify-between gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
          {categoryName ? <span style={{ color: meta.accent }}>{categoryName}</span> : <span />}
          {meta.brand && <span className="text-faint">{meta.brand}</span>}
        </div>

        <h3 className="text-[1.02rem] leading-snug font-semibold text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-cyan focus-visible:outline-none">
            {product.product_name}
          </Link>
        </h3>

        {showDescription && product.description && (
          <p className="line-clamp-2 text-sm text-dim">{specText(product.description)}</p>
        )}

        {showStock && product.is_active && (
          <div className="pt-1">
            <StockMeter stock={product.stock_quantity} isActive={product.is_active} />
            {availability === "low-stock" && (
              <p className="mt-1 font-mono text-[0.7rem] text-amber">Only {product.stock_quantity} left</p>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
          <p className="font-mono text-lg font-semibold text-ink tabular" data-testid="product-price">
            {formatIDR(product.price)}
          </p>
        </div>

        {readOnly ? (
          <p className="font-mono text-[0.7rem] tracking-[0.16em] text-cyan uppercase" aria-hidden>
            View details →
          </p>
        ) : (
        /* relative z-10 keeps the controls above the card-wide link overlay */
        <div className={cx("relative z-10 flex items-center gap-2", !showQuantity && "justify-end")}>
          {showQuantity && purchasable && (
            <QuantityCounter value={Math.min(quantity, maxQty)} onChange={setQuantity} max={maxQty} size="sm" />
          )}
          <AddToCartButton
            product={product}
            quantity={Math.min(quantity, maxQty)}
            className="flex-1"
            onAdded={() => setQuantity(1)}
          />
        </div>
        )}
      </div>
    </Card>
  );
}
