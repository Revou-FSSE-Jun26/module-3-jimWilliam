import { cx } from "@/lib/classes";
import { formatIDR, formatIDRCompact, LOW_STOCK_THRESHOLD, STATUS_LABEL } from "@/lib/format";
import type { Order, OrderStatus, Product } from "@/lib/types";

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "var(--color-amber)",
  paid: "var(--color-cyan)",
  shipped: "var(--color-blue)",
  delivered: "var(--color-lime)",
  cancelled: "var(--color-rose)",
};
const STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];

/**
 * Admin heads-up display. Pure derivation from the products and orders already on the page -
 * no extra requests and no chart library; the donut is a handful of SVG circle segments.
 */
export default function StatsHUD({ products, orders }: { products: Product[]; orders: Order[] }) {
  const live = orders.filter((o) => o.order_status !== "cancelled");
  const revenue = live.reduce((sum, o) => sum + o.total_amount, 0);
  const avgOrder = live.length ? revenue / live.length : 0;
  const lowStock = products
    .filter((p) => p.is_active && p.stock_quantity < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock_quantity - b.stock_quantity);
  const inactive = products.filter((p) => !p.is_active).length;
  const stockValue = products.reduce((sum, p) => sum + p.price * p.stock_quantity, 0);
  const byStatus = STATUSES.map((s) => ({ status: s, count: orders.filter((o) => o.order_status === s).length }));

  return (
    <section aria-label="Store overview" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4" data-testid="stats-hud">
      <Tile label="Revenue" accent="var(--color-lime)" note={`${live.length} orders · excl. cancelled`}>
        <p className="font-mono text-3xl text-lime tabular" title={formatIDR(revenue)} data-testid="hud-revenue">
          {formatIDRCompact(revenue)}
        </p>
        <p className="mt-1 font-mono text-xs text-dim">avg {formatIDRCompact(avgOrder)} / order</p>
      </Tile>

      <Tile label="Orders by status" accent="var(--color-cyan)" note={`${orders.length} total`}>
        <div className="flex items-center gap-4">
          <Donut data={byStatus} total={orders.length} />
          <ul className="space-y-1 text-xs">
            {byStatus.map((s) => (
              <li key={s.status} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s.status] }} aria-hidden />
                <span className="w-16 text-dim">{STATUS_LABEL[s.status]}</span>
                <span className="font-mono tabular">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </Tile>

      <Tile label="Low stock" accent="var(--color-amber)" note={`under ${LOW_STOCK_THRESHOLD} units`}>
        {lowStock.length === 0 ? (
          <p className="text-sm text-dim">Everything is well stocked.</p>
        ) : (
          <ul className="space-y-2" data-testid="hud-low-stock">
            {lowStock.slice(0, 4).map((p) => (
              <li key={p.product_id} className="space-y-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{p.product_name}</span>
                  <span className={cx("font-mono tabular", p.stock_quantity === 0 ? "text-rose" : "text-amber")}>{p.stock_quantity}</span>
                </div>
                <div className="h-1 rounded-full bg-line">
                  <div
                    className={cx("h-full rounded-full", p.stock_quantity === 0 ? "bg-rose" : "bg-amber")}
                    style={{ width: `${Math.max(4, (p.stock_quantity / LOW_STOCK_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <Tile label="Catalogue" accent="var(--color-magenta)" note={`${inactive} not for sale`}>
        <p className="font-mono text-3xl text-magenta tabular">{products.length}</p>
        <p className="mt-1 font-mono text-xs text-dim">products · {formatIDRCompact(stockValue)} on the shelf</p>
      </Tile>
    </section>
  );
}

function Tile({ label, note, accent, children }: { label: string; note: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="panel clip-hud relative space-y-3 p-5">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} aria-hidden />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[0.68rem] tracking-[0.18em] text-faint uppercase">{label}</h3>
        <span className="font-mono text-[0.65rem] text-faint">{note}</span>
      </div>
      {children}
    </div>
  );
}

function Donut({ data, total }: { data: { status: OrderStatus; count: number }[]; total: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={data.map((d) => `${d.count} ${d.status}`).join(", ")}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
      {total > 0 &&
        data
          .filter((d) => d.count > 0)
          .map((d) => {
            const len = (d.count / total) * C;
            const seg = (
              <circle
                key={d.status}
                cx="40"
                cy="40"
                r={R}
                fill="none"
                stroke={STATUS_COLOR[d.status]}
                strokeWidth="10"
                strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return seg;
          })}
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="fill-ink font-mono text-[15px]" transform="rotate(90 40 40)">
        {total}
      </text>
    </svg>
  );
}
