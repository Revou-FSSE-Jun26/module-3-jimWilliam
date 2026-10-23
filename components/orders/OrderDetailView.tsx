"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import ProductImage from "@/components/product/ProductImage";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useApiData } from "@/hooks/useApiData";
import { ApiError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants } from "@/lib/classes";
import { formatIDR } from "@/lib/format";

/**
 * One order with its line items. Loaded in the browser with the user's token: the API answers
 * the owner, or anyone who manages orders, and 403 for everyone else.
 */
export default function OrderDetailView({ id }: { id: number }) {
  const { fmt } = useSettings();
  const { currentUser } = useAuth();
  const { data: order, error } = useApiData(currentUser ? `order:${id}:${currentUser.id}` : null, () => api.order(id));

  if (error instanceof ApiError && error.status === 404) notFound();
  if (error && !(error instanceof ApiError && error.status === 403)) throw error; // -> app/orders/error.tsx

  if (error) {
    return (
      <div className="panel grid place-items-center gap-4 px-6 py-20 text-center">
        <p className="text-dim" data-testid="order-forbidden">
          This order belongs to another account.
        </p>
        <Link href="/orders" className={buttonVariants.secondary}>
          Back to my orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-busy data-testid="order-loading">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section className="panel overflow-hidden" aria-labelledby="items">
        <h2 id="items" className="border-b border-line px-6 py-4 font-mono text-xs tracking-[0.2em] text-cyan uppercase">
          Items
        </h2>
        <ul className="divide-y divide-line" data-testid="order-items">
          {order.items.map((i) => (
            <li key={i.order_item_id} className="flex items-center gap-4 px-6 py-4">
              <ProductImage
                product={{ product_id: i.product_id, category_id: 0, product_name: i.product_name }}
                sizes="64px"
                className="size-14 shrink-0 rounded-lg border border-line"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/products/${i.product_id}`} className="font-medium hover:text-cyan">
                  {i.product_name}
                </Link>
                <p className="font-mono text-xs text-faint">
                  {i.quantity} × {formatIDR(i.unit_price)}
                </p>
              </div>
              <p className="font-mono tabular">{formatIDR(i.line_total)}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="panel h-fit space-y-4 p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">Status</p>
          <StatusBadge status={order.order_status} />
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-faint">Placed</dt>
            <dd>{fmt.dateTime(order.ordered_at)}</dd>
          </div>
          <div>
            <dt className="text-faint">Ship to</dt>
            <dd className="whitespace-pre-line">{order.shipping_address}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-dim">Total</dt>
            <dd className="font-mono text-xl font-semibold tabular" data-testid="order-total">
              {formatIDR(order.total_amount)}
            </dd>
          </div>
        </dl>
        <Link href="/orders" className={`${buttonVariants.ghost} w-full`}>
          ← All orders
        </Link>
      </aside>
    </div>
  );
}
