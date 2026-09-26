import { cx } from "@/lib/classes";
import { availabilityOf } from "@/lib/format";

/** A thin HUD bar: how much stock is left relative to a "full shelf" of 50 units. */
export default function StockMeter({
  stock,
  isActive = true,
  className,
}: {
  stock: number;
  isActive?: boolean;
  className?: string;
}) {
  const availability = availabilityOf({ stock_quantity: stock, is_active: isActive });
  const pct = Math.max(4, Math.min(100, (stock / 50) * 100));
  const color = availability === "in-stock" ? "bg-lime" : availability === "low-stock" ? "bg-amber" : "bg-rose";
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <div
        className="h-1 flex-1 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label="Stock level"
        aria-valuemin={0}
        aria-valuemax={50}
        aria-valuenow={Math.min(stock, 50)}
      >
        {availability !== "unavailable" && stock > 0 && (
          <div className={cx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="font-mono text-[0.7rem] text-dim tabular">{stock}</span>
    </div>
  );
}
