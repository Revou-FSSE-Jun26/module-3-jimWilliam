"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { buttonVariants } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const STEPS: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];

/**
 * The Server Component fetches GET /orders; this narrows it to the signed-in customer. The
 * Flask API does that scoping itself from the JWT - the mock cannot, so it happens here.
 */
export default function OrdersView({ orders }: { orders: Order[] }) {
  const { fmt } = useSettings();
  const { currentUser, isAdmin } = useAuth();
  const mine = orders.filter((o) => o.user_id === currentUser?.id);

  // admins handle everyone's orders in the dashboard; this page is only their own purchases
  const adminNote = isAdmin && (
    <p className="mb-4 rounded-xl border border-magenta/40 bg-magenta/5 px-4 py-3 text-sm text-dim" data-testid="orders-admin-note">
      These are your own purchases. To handle customers&apos; orders, go to{" "}
      <Link href="/dashboard/orders" className="text-cyan hover:underline">
        Dashboard → Orders
      </Link>
      .
    </p>
  );

  if (mine.length === 0) {
    return (
      <>
        {adminNote}
        <div className="panel grid place-items-center gap-4 px-6 py-20 text-center" data-testid="orders-empty">
          <p className="font-mono text-xs tracking-[0.24em] text-faint uppercase">{"// "}no orders yet</p>
          <p className="text-dim">When you check out, your orders show up here.</p>
          <Link href="/products" className={buttonVariants.primary}>
            Start shopping
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {adminNote}
      <ul className="space-y-4" data-testid="orders-list">
        {mine.map((o) => {
          const step = STEPS.indexOf(o.order_status);
          return (
            <li key={o.order_id}>
              <Card
                as={Link}
                href={`/orders/${o.order_id}`}
                interactive
                className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                data-testid="order-row"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-lg">#{String(o.order_id).padStart(4, "0")}</p>
                    <StatusBadge status={o.order_status} />
                  </div>
                  <p className="text-sm text-dim">
                    {fmt.dateTime(o.ordered_at)} · {o.item_count ?? "—"} {o.item_count === 1 ? "item" : "items"}
                  </p>
                  {o.order_status !== "cancelled" && (
                    <ol className="flex max-w-xs gap-1.5 pt-1" aria-label={`Progress: ${o.order_status}`}>
                      {STEPS.map((s, i) => (
                        <li key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-cyan" : "bg-line"}`} title={s} />
                      ))}
                    </ol>
                  )}
                </div>
                <p className="font-mono text-xl font-semibold tabular sm:text-right">{formatIDR(o.total_amount)}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
