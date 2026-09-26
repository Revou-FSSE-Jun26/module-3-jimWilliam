"use client";

import { useMemo, useState } from "react";
import OrderManager, { NEXT_STEP, orderNo } from "@/components/dashboard/OrderManager";
import { StatusBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { ApiError, describeError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { api } from "@/lib/api.client";
import { buttonVariants, cx } from "@/lib/classes";
import { formatIDR, STATUS_LABEL } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Order, OrderDetail, OrderStatus } from "@/lib/types";

const FILTERS: ("all" | OrderStatus)[] = ["all", "pending", "paid", "shipped", "delivered", "cancelled"];

/**
 * Every customer's orders, for handling them: a one-click "next step" on each row (pending ->
 * paid -> shipped -> delivered) and a Manage dialog for everything else. Updates go through
 * PUT /orders/[id] and are applied to the row with .map() once the API answers.
 */
export default function OrdersTable({ orders: initial }: { orders: Order[] }) {
  const { fmt } = useSettings();
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [managing, setManaging] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const rows = useMemo(() => (filter === "all" ? orders : orders.filter((o) => o.order_status === filter)), [orders, filter]);
  const total = rows.reduce((s, o) => s + (o.order_status === "cancelled" ? 0 : o.total_amount), 0);
  const count = (f: (typeof FILTERS)[number]) => (f === "all" ? orders.length : orders.filter((o) => o.order_status === f).length);

  const apply = (o: OrderDetail) =>
    setOrders((list) => list.map((x) => (x.order_id === o.order_id ? { ...x, order_status: o.order_status, shipping_address: o.shipping_address } : x)));

  async function advance(o: Order) {
    const next = NEXT_STEP[o.order_status];
    if (!next) return;
    setBusyId(o.order_id);
    try {
      const res = await api.updateOrder(o.order_id, { order_status: next.to });
      apply(res.order);
      toast.success(`${orderNo(o.order_id)} marked as ${STATUS_LABEL[next.to].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.body.details?.[0] ?? e.message) : describeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel overflow-hidden" aria-labelledby="orders-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 id="orders-title" className="text-lg font-semibold">
            All orders
          </h2>
          <p className="font-mono text-xs text-faint">
            {rows.length} shown · {formatIDR(total)} excl. cancelled
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "rounded-lg px-3 py-1.5 font-mono text-[0.68rem] tracking-widest uppercase transition",
                filter === f ? "bg-cyan/15 text-cyan" : "text-dim hover:bg-surface-2"
              )}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]} <span className="text-faint">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 text-sm" data-testid="admin-orders-table">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[0.66rem] tracking-[0.14em] text-faint uppercase">
              <th scope="col" className="px-5 py-3 font-normal">Order</th>
              <th scope="col" className="px-3 py-3 font-normal">Customer</th>
              <th scope="col" className="px-3 py-3 font-normal">Placed</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Items</th>
              <th scope="col" className="px-3 py-3 font-normal">Status</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Total</th>
              <th scope="col" className="px-5 py-3 text-right font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const next = NEXT_STEP[o.order_status];
              return (
                <tr key={o.order_id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40" data-testid="admin-order-row">
                  <td className="px-5 py-3 font-mono">{orderNo(o.order_id)}</td>
                  <td className="px-3 py-3">
                    {o.username ?? `User ${o.user_id}`}
                    <span className="block font-mono text-[0.65rem] text-faint">id {o.user_id}</span>
                  </td>
                  <td className="px-3 py-3 text-dim">{fmt.dateTime(o.ordered_at)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular">{o.item_count ?? "—"}</td>
                  <td className="px-3 py-3" data-testid="admin-order-status">
                    <StatusBadge status={o.order_status} />
                  </td>
                  <td className={cx("px-3 py-3 text-right font-mono tabular", o.order_status === "cancelled" && "text-faint line-through")}>
                    {formatIDR(o.total_amount)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {next && (
                        <button
                          type="button"
                          disabled={busyId === o.order_id}
                          onClick={() => advance(o)}
                          className={cx(buttonVariants.secondary, "px-3 py-1.5 text-xs whitespace-nowrap")}
                          data-testid="order-next"
                        >
                          {busyId === o.order_id ? "Saving…" : next.label}
                        </button>
                      )}
                      <button type="button" onClick={() => setManaging(o.order_id)} className={cx(buttonVariants.ghost, "px-3 py-1.5 text-xs")} data-testid="order-manage">
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={managing !== null} onClose={() => setManaging(null)} title={managing !== null ? `Order ${orderNo(managing)}` : "Order"} testId="order-modal">
        {managing !== null && <OrderManager key={managing} orderId={managing} onChanged={apply} />}
      </Modal>
    </section>
  );
}
