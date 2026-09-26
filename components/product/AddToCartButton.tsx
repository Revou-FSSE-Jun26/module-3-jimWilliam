"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { buttonVariants, cx, getButtonClasses } from "@/lib/classes";
import { toast } from "@/lib/toast";
import type { Product } from "@/lib/types";

type Buyable = Pick<Product, "product_id" | "product_name" | "price" | "stock_quantity" | "is_active">;

export default function AddToCartButton({
  product,
  quantity = 1,
  className,
  onAdded,
}: {
  product: Buyable;
  quantity?: number;
  className?: string;
  onAdded?: () => void;
}) {
  const { isLoggedIn, isReady } = useAuth();
  const { addToCart, quantityOf } = useCart();
  const pathname = usePathname();

  // Before the session is restored we do not know which button to show - render an inert
  // placeholder of the same size rather than flashing "Login to buy" at a signed-in user.
  if (!isReady) {
    return (
      <span className={cx(getButtonClasses(false), "opacity-60", className)} aria-hidden>
        Add to cart
      </span>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={cx(buttonVariants.secondary, "px-4", className)}
        data-testid="login-to-buy"
      >
        Login to buy
      </Link>
    );
  }

  const inCart = quantityOf(product.product_id);
  const remaining = product.stock_quantity - inCart;
  const canBuy = product.is_active && remaining > 0;

  const label = !product.is_active
    ? "Unavailable"
    : product.stock_quantity <= 0
      ? "Sold out"
      : remaining <= 0
        ? "Max in cart"
        : "Add to cart";

  return (
    <button
      type="button"
      disabled={!canBuy}
      className={cx(getButtonClasses(canBuy), className)}
      data-testid="add-to-cart"
      onClick={() => {
        const qty = Math.min(quantity, remaining);
        addToCart(product, qty);
        toast.success(`${qty} × ${product.product_name} added to cart`);
        onAdded?.();
      }}
    >
      {canBuy && (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      )}
      {label}
    </button>
  );
}
