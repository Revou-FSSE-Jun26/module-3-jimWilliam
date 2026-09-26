"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductImage from "@/components/product/ProductImage";
import QuantityCounter from "@/components/ui/QuantityCounter";
import { useCart } from "@/context/CartContext";
import { buttonVariants, cx } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import { toast } from "@/lib/toast";

/** Everything on /cart: the line-item table, remove buttons, total and the checkout gate. */
export default function CartView() {
  const router = useRouter();
  const { items, itemCount, total, isReady, updateQuantity, removeFromCart, clearCart } = useCart();
  const empty = items.length === 0;

  if (!isReady) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="cart-items">
        <h2 id="cart-items" className="sr-only">
          Items
        </h2>
        {empty ? (
          <div className="panel grid place-items-center gap-4 px-6 py-20 text-center" data-testid="cart-empty">
            <p className="font-mono text-xs tracking-[0.24em] text-faint uppercase">{"// "}cart empty</p>
            <p className="text-dim">Nothing here yet. The RTX 5070 is running low, just saying.</p>
            <Link href="/products" className={buttonVariants.primary}>
              Browse products
            </Link>
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="cart-table">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[0.68rem] tracking-[0.14em] text-faint uppercase">
                  <th scope="col" className="px-5 py-3.5 font-normal">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right font-normal">
                    Price
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center font-normal">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right font-normal">
                    Total
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product_id} className="border-b border-line/60 last:border-0" data-testid="cart-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <ProductImage
                          product={{ product_id: item.product_id, category_id: 0, product_name: item.product_name }}
                          sizes="64px"
                          className="size-14 shrink-0 rounded-lg border border-line"
                        />
                        <Link href={`/products/${item.product_id}`} className="font-medium hover:text-cyan">
                          {item.product_name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-dim tabular">{formatIDR(item.price)}</td>
                    <td className="px-3 py-4 text-center">
                      <QuantityCounter
                        size="sm"
                        value={item.quantity}
                        max={item.stock_quantity}
                        onChange={(q) => updateQuantity(item.product_id, q)}
                        label={`Quantity of ${item.product_name}`}
                      />
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-ink tabular" data-testid="cart-line-total">
                      {formatIDR(item.price * item.quantity)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          removeFromCart(item.product_id);
                          toast.success(`Removed ${item.product_name}`);
                        }}
                        className="rounded-lg px-2 py-1 font-mono text-xs text-faint transition hover:bg-rose/10 hover:text-rose"
                        aria-label={`Remove ${item.product_name} from cart`}
                        data-testid="cart-remove"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="panel h-fit space-y-5 p-6 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Summary</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-dim">Items</dt>
            <dd className="font-mono tabular" data-testid="cart-item-count">
              {itemCount}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-dim">Shipping</dt>
            <dd className="font-mono text-lime">Free</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base">
            <dt>Total</dt>
            <dd className="font-mono font-semibold text-ink tabular" data-testid="cart-total">
              {formatIDR(total)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={empty}
          onClick={() => router.push("/checkout")}
          className={cx(buttonVariants.primary, "w-full py-3")}
          data-testid="checkout-button"
        >
          Proceed to checkout
        </button>
        {empty && <p className="text-center text-xs text-faint">Add something to your cart to check out.</p>}
        {!empty && (
          <button
            type="button"
            onClick={() => {
              clearCart();
              toast.success("Cart cleared");
            }}
            className={cx(buttonVariants.ghost, "w-full")}
          >
            Clear cart
          </button>
        )}
      </aside>
    </div>
  );
}
