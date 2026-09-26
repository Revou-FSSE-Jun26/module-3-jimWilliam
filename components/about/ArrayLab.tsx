"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

/**
 * Checkpoint 1 - forEach, map, filter and reduce over the live catalogue. Each panel shows the
 * exact expression next to its result, and the controls re-run them as you change the input.
 */
export default function ArrayLab({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [maxPrice, setMaxPrice] = useState(6_000_000);
  const [inStockOnly, setInStockOnly] = useState(true);

  // forEach - iterate and accumulate into an object (a side effect, which is what forEach is for)
  const perCategory = useMemo(() => {
    const tally: Record<string, number> = {};
    products.forEach((p) => {
      const name = categories.find((c) => c.category_id === p.category_id)?.category_name ?? "Other";
      tally[name] = (tally[name] ?? 0) + 1;
    });
    return tally;
  }, [products, categories]);

  // filter - keep only what matches the controls
  const affordable = useMemo(
    () => products.filter((p) => p.price <= maxPrice && (!inStockOnly || (p.is_active && p.stock_quantity > 0))),
    [products, maxPrice, inStockOnly]
  );

  // map - transform each product into a display label
  const labels = useMemo(() => affordable.map((p) => `${p.product_name} — ${formatIDR(p.price)}`), [affordable]);

  // reduce - aggregate to single values
  const stats = useMemo(() => {
    const stockValue = products.reduce((sum, p) => sum + p.price * p.stock_quantity, 0);
    const units = products.reduce((n, p) => n + p.stock_quantity, 0);
    const cheapest = products.reduce((min, p) => (p.price < min.price ? p : min), products[0]);
    const basket = affordable.reduce((sum, p) => sum + p.price, 0);
    return { stockValue, units, cheapest, basket, avg: products.length ? stockValue / units : 0 };
  }, [products, affordable]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Lab title="forEach" code={`products.forEach((p) => {\n  tally[categoryOf(p)] += 1;\n});`}>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.entries(perCategory).map(([name, n]) => (
            <li key={name} className="flex justify-between gap-2">
              <span className="truncate text-dim">{name}</span>
              <span className="font-mono text-cyan">{n}</span>
            </li>
          ))}
        </ul>
      </Lab>

      <Lab
        title="reduce"
        code={`products.reduce(\n  (sum, p) => sum + p.price * p.stock_quantity, 0\n);`}
      >
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Stock value" value={formatIDR(stats.stockValue)} />
          <Stat label="Units on shelf" value={String(stats.units)} />
          <Stat label="Avg unit price" value={formatIDR(Math.round(stats.avg))} />
          <Stat label="Cheapest" value={stats.cheapest?.product_name ?? "—"} />
        </dl>
      </Lab>

      <Lab
        title="filter + map"
        className="lg:col-span-2"
        code={`products\n  .filter((p) => p.price <= max && inStock(p))\n  .map((p) => \`\${p.product_name} — \${formatIDR(p.price)}\`);`}
      >
        <div className="flex flex-wrap items-center gap-5 pb-3">
          <label className="flex flex-1 items-center gap-3 text-sm text-dim">
            Max price
            <input
              type="range"
              min={100_000}
              max={14_000_000}
              step={50_000}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="flex-1 accent-cyan"
            />
            <span className="w-32 text-right font-mono text-ink tabular">{formatIDR(maxPrice)}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-dim">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 accent-cyan" />
            In stock only
          </label>
        </div>
        <p className="pb-2 font-mono text-xs text-faint">
          {labels.length} match · buying one of each: <span className="text-lime">{formatIDR(stats.basket)}</span>
        </p>
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-2 text-sm">
          {labels.map((l) => (
            <li key={l} className="text-dim">
              {l}
            </li>
          ))}
        </ul>
      </Lab>
    </div>
  );
}

function Lab({ title, code, children, className }: { title: string; code: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("panel space-y-4 p-5", className)}>
      <h3 className="font-mono text-sm text-magenta">.{title}()</h3>
      <pre className="overflow-x-auto rounded-xl border border-line bg-void/70 p-3 font-mono text-[0.72rem] leading-relaxed text-cyan">{code}</pre>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-faint uppercase">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
