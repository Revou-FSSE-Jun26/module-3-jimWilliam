"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import { toast } from "@/lib/toast";

/** Review the cart, confirm a shipping address, then POST /orders. */
export default function CheckoutView() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { items, total, itemCount, clearCart, isReady } = useCart();
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string[] | null>(null);

  // prefill the address from the account, but never overwrite what the user has typed
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    api
      .user(currentUser.id)
      .then((u) => {
        if (!cancelled && u.address) setAddress((a) => a || u.address!);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!isReady) return null;

  if (items.length === 0) {
    return (
      <div className="panel grid place-items-center gap-4 px-6 py-20 text-center">
        <p className="text-dim">Your cart is empty — there&apos;s nothing to check out.</p>
        <Link href="/products" className={buttonVariants.primary}>
          Browse products
        </Link>
      </div>
    );
  }

  const addressError = touched && address.trim().length < 10 ? "Enter a full shipping address." : null;

  const confirm = async () => {
    setTouched(true);
    if (!currentUser || address.trim().length < 10) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await api.createOrder({
        user_id: currentUser.id,
        shipping_address: address.trim(),
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      const order = "order" in res ? res.order : res;
      clearCart();
      toast.success(`Order #${order.order_id} placed — ${formatIDR(order.total_amount)}`);
      router.push("/orders");
      router.refresh();
    } catch (e) {
      // a 400 carries the backend's reasons, e.g. "only 6 left of NVIDIA GeForce RTX 5070 12GB"
      setError(e instanceof ApiError && e.body.details?.length ? e.body.details : [describeError(e)]);
      toast.error(e);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <section className="panel space-y-4 p-6" aria-labelledby="ship">
          <h2 id="ship" className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">
            Shipping
          </h2>
          <p className="text-sm text-dim">
            Ordering as <span className="text-ink">{currentUser?.username}</span> ({currentUser?.email})
          </p>
          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm text-dim">
              Shipping address
            </label>
            <textarea
              id="address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={addressError ? true : undefined}
              aria-describedby={addressError ? "address-error" : undefined}
              className={cx(inputClasses, "resize-y")}
              placeholder="Street, number, city"
              data-testid="shipping-address"
            />
            {addressError && (
              <p id="address-error" className="text-xs text-rose">
                {addressError}
              </p>
            )}
          </div>
        </section>

        <section className="panel p-6" aria-labelledby="review">
          <h2 id="review" className="mb-4 font-mono text-xs tracking-[0.2em] text-cyan uppercase">
            Review {itemCount} {itemCount === 1 ? "item" : "items"}
          </h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.product_id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  {i.product_name} <span className="font-mono text-faint">× {i.quantity}</span>
                </span>
                <span className="font-mono tabular">{formatIDR(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="panel h-fit space-y-5 p-6 lg:sticky lg:top-24">
        <h2 className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Payment</h2>
        <div className="flex items-baseline justify-between">
          <span className="text-dim">Total</span>
          <span className="font-mono text-2xl font-semibold tabular" data-testid="checkout-total">
            {formatIDR(total)}
          </span>
        </div>
        {error && (
          <div role="alert" className="space-y-1 rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose">
            <p className="font-medium">Couldn&apos;t place the order:</p>
            <ul className="list-inside list-disc">
              {error.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={confirm} disabled={placing} className={cx(buttonVariants.primary, "w-full py-3")} data-testid="confirm-order">
          {placing ? "Placing order…" : "Confirm order"}
        </button>
        <p className="text-xs text-faint">Demo store — no payment is taken. The order is created with status “pending”.</p>
        <Link href="/cart" className={cx(buttonVariants.ghost, "w-full")}>
          ← Back to cart
        </Link>
      </aside>
    </div>
  );
}
