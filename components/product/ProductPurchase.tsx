"use client";

import { useState } from "react";
import AddToCartButton from "@/components/product/AddToCartButton";
import QuantityCounter from "@/components/ui/QuantityCounter";
import { useCart } from "@/context/CartContext";
import { availabilityOf } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Quantity picker + add-to-cart for the detail page. */
export default function ProductPurchase({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const { quantityOf } = useCart();
  const inCart = quantityOf(product.product_id);
  const availability = availabilityOf(product);
  const purchasable = availability === "in-stock" || availability === "low-stock";
  const maxQty = Math.max(1, product.stock_quantity - inCart);
  const qty = Math.min(quantity, maxQty);

  return (
    <div className="space-y-3" data-testid="purchase">
      <div className="flex flex-wrap items-center gap-3">
        {purchasable && <QuantityCounter value={qty} onChange={setQuantity} max={maxQty} />}
        <AddToCartButton product={product} quantity={qty} className="h-10 min-w-48 flex-1" onAdded={() => setQuantity(1)} />
      </div>
      {inCart > 0 && (
        <p className="font-mono text-xs text-cyan">
          {inCart} already in your cart{product.stock_quantity - inCart <= 0 ? " — that's all we have" : ""}
        </p>
      )}
    </div>
  );
}
