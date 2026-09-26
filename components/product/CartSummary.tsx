"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { buttonVariants, cx } from "@/lib/classes";
import { formatIDR } from "@/lib/format";

/** Live item count and total, fed by the same CartContext the header badge reads. */
export default function CartSummary({ className }: { className?: string }) {
  const { itemCount, total, isReady } = useCart();
  const { isLoggedIn } = useAuth();

  // guests have no cart (they get "Login to buy"), so there is nothing to summarise
  if (!isLoggedIn) return null;

  return (
    <aside
      className={cx("panel flex flex-wrap items-center justify-between gap-4 px-5 py-4", className)}
      aria-label="Cart summary"
      data-testid="cart-summary"
    >
      <div className="flex items-center gap-6">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.18em] text-faint uppercase">Items</p>
          <p className="font-mono text-xl text-ink tabular" data-testid="cart-summary-count">
            {isReady ? itemCount : "–"}
          </p>
        </div>
        <div className="h-9 w-px bg-line" aria-hidden />
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.18em] text-faint uppercase">Total</p>
          <p className="font-mono text-xl text-lime tabular" data-testid="cart-summary-total">
            {isReady ? formatIDR(total) : "–"}
          </p>
        </div>
      </div>
      <Link href="/cart" className={cx(buttonVariants.secondary, itemCount === 0 && "pointer-events-none opacity-50")} aria-disabled={itemCount === 0}>
        View cart →
      </Link>
    </aside>
  );
}
