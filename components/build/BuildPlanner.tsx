"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProductImage from "@/components/product/ProductImage";
import Card from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { buttonVariants, cx, inputClasses } from "@/lib/classes";
import {
  checkBuild,
  estimateDraw,
  optionConflict,
  psuWattsOf,
  SLOTS,
  slotsFor,
  socketOf,
  type Build,
  type Check,
  type Severity,
  type SlotId,
} from "@/lib/compat";
import { formatIDR } from "@/lib/format";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { toast } from "@/lib/toast";
import type { Product } from "@/lib/types";

const STORAGE_KEY = STORAGE_KEYS.build;

const SEVERITY_STYLE: Record<Severity, { box: string; dot: string; label: string }> = {
  error: { box: "border-rose/40 bg-rose/10", dot: "bg-rose", label: "text-rose" },
  warning: { box: "border-amber/40 bg-amber/10", dot: "bg-amber", label: "text-amber" },
  info: { box: "border-line-bright bg-surface-2/60", dot: "bg-blue", label: "text-blue" },
  ok: { box: "border-lime/30 bg-lime/5", dot: "bg-lime", label: "text-lime" },
};

/** Starting points that are known to pass every check. */
const PRESETS: { id: string; label: string; picks: Partial<Record<SlotId, number>> }[] = [
  { id: "intel", label: "Intel Core Ultra", picks: { cpu: 2, motherboard: 4, ram: 7, storage: 9, gpu: 12, psu: 14, cooler: 15, fan: 16 } },
  { id: "amd", label: "AMD Ryzen X3D", picks: { cpu: 3, motherboard: 5, ram: 7, storage: 9, gpu: 13, psu: 14, cooler: 15 } },
  { id: "budget", label: "Budget", picks: { cpu: 1, motherboard: 6, ram: 7, storage: 10, psu: 14, cooler: 15 } },
];

export default function BuildPlanner({ products }: { products: Product[] }) {
  const { isLoggedIn, isReady } = useAuth();
  const { addToCart, quantityOf } = useCart();
  const [picks, setPicks] = useState<Partial<Record<SlotId, number>>>({});
  const [ready, setReady] = useState(false);

  // restore / persist the build, the same way the cart does
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      if (raw) setPicks(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  // gated on state, not a ref - see CartContext for why
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
    } catch {
      /* ignore */
    }
  }, [picks, ready]);

  const byId = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products]);
  const options = useMemo(() => {
    const map = {} as Record<SlotId, Product[]>;
    for (const s of SLOTS) map[s.id] = products.filter((p) => slotsFor(p).includes(s.id)).sort((a, b) => a.price - b.price);
    return map;
  }, [products]);

  const build: Build = useMemo(() => {
    const b: Build = {};
    for (const [slot, id] of Object.entries(picks) as [SlotId, number][]) {
      const p = byId.get(id);
      if (p) b[slot] = p;
    }
    return b;
  }, [picks, byId]);

  const parts = Object.values(build).filter(Boolean) as Product[];
  const total = parts.reduce((s, p) => s + p.price, 0);
  const checks = checkBuild(build);
  const errors = checks.filter((c) => c.severity === "error").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;

  // The most serious check touching each slot, shown right on that slot - so a problem appears
  // where the part was just picked, not only in the summary (which sits below every slot on
  // narrower screens and was easy to miss entirely).
  const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2, ok: 3 };
  const slotCheck = (id: SlotId): Check | undefined =>
    checks.filter((c) => c.slots.includes(id)).sort((a, b) => RANK[a.severity] - RANK[b.severity])[0];
  const { draw, recommended } = estimateDraw(build);
  const psuRated = build.psu ? psuWattsOf(build.psu) : null;
  const buyable = parts.filter((p) => p.is_active && p.stock_quantity - quantityOf(p.product_id) > 0);

  const addAll = () => {
    buyable.forEach((p) => addToCart(p, 1));
    toast.success(`${buyable.length} parts added to your cart`);
  };

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_24rem] lg:pb-0">
      <section className="space-y-4" aria-label="Parts">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.68rem] tracking-[0.18em] text-faint uppercase">Start from</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPicks(p.picks)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim transition hover:border-cyan hover:text-cyan"
              data-testid={`preset-${p.id}`}
            >
              {p.label}
            </button>
          ))}
          {parts.length > 0 && (
            <button type="button" onClick={() => setPicks({})} className="ml-auto text-xs text-faint hover:text-rose">
              Clear build
            </button>
          )}
        </div>

        <ul className="space-y-3">
          {SLOTS.map((slot) => {
            const chosen = build[slot.id];
            const socket = chosen ? socketOf(chosen) : null;
            const status = slotCheck(slot.id);
            return (
              <li key={slot.id}>
                <Card
                  className={cx(
                    "p-4 transition-colors",
                    status?.severity === "error"
                      ? "border-rose/60 shadow-[0_0_30px_-12px_var(--color-rose)]"
                      : status?.severity === "warning"
                        ? "border-amber/50"
                        : status?.severity === "ok"
                          ? "border-lime/30"
                          : chosen && "border-line-bright"
                  )}
                  data-testid={`build-slot-${slot.id}`}
                  data-status={status?.severity ?? "none"}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 sm:w-64 sm:shrink-0">
                    {chosen ? (
                      <ProductImage product={chosen} sizes="56px" className="size-14 shrink-0 rounded-lg border border-line" />
                    ) : (
                      <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-dashed border-line-bright font-mono text-xs text-faint">+</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">
                        {slot.label}
                        {slot.required && <span className="text-magenta"> *</span>}
                      </p>
                      {chosen ? (
                        <Link href={`/products/${chosen.product_id}`} className="block truncate text-sm font-medium hover:text-cyan">
                          {chosen.product_name}
                        </Link>
                      ) : (
                        <p className="text-sm text-dim">{slot.required ? "Required" : "Optional"}</p>
                      )}
                      {socket && <p className="font-mono text-[0.65rem] text-blue">{socket}</p>}
                    </div>
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <label htmlFor={`slot-${slot.id}`} className="sr-only">
                      Choose {slot.label}
                    </label>
                    <select
                      id={`slot-${slot.id}`}
                      value={chosen ? String(chosen.product_id) : ""}
                      onChange={(e) =>
                        setPicks((prev) => {
                          const next = { ...prev };
                          if (e.target.value) next[slot.id] = Number(e.target.value);
                          else delete next[slot.id];
                          return next;
                        })
                      }
                      className={cx(inputClasses, "h-11 cursor-pointer py-2")}
                      data-testid={`slot-${slot.id}`}
                    >
                      <option value="">— none —</option>
                      {options[slot.id].map((p) => {
                        // flag options that would clash with the rest of the build, before they are picked
                        const conflict = chosen?.product_id === p.product_id ? null : optionConflict(slot.id, p, build);
                        return (
                          <option key={p.product_id} value={p.product_id} disabled={!p.is_active || p.stock_quantity === 0}>
                            {conflict ? "✕ " : ""}
                            {p.product_name} · {formatIDR(p.price)}
                            {!p.is_active ? " (unavailable)" : p.stock_quantity === 0 ? " (sold out)" : conflict ? ` — ${conflict}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <span className="hidden w-32 shrink-0 text-right font-mono text-sm tabular sm:block">{chosen ? formatIDR(chosen.price) : ""}</span>
                  </div>
                  </div>
                  {status && status.severity !== "info" && (
                    <p
                      className={cx("mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs", SEVERITY_STYLE[status.severity].label)}
                      data-testid={`build-slot-${slot.id}-status`}
                    >
                      <span className="mt-0.5 font-mono" aria-hidden>
                        {status.severity === "error" ? "✕" : status.severity === "warning" ? "!" : "✓"}
                      </span>
                      <span>
                        <span className="font-medium">{status.title}</span>
                        {status.severity !== "ok" && <span className="text-dim"> — {status.detail}</span>}
                      </span>
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="h-fit space-y-5 lg:sticky lg:top-24" aria-label="Build summary">
        <Card className="space-y-5 p-6">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">Build total</p>
            <p className="font-mono text-xs text-faint">{parts.length} parts</p>
          </div>
          <p className="font-mono text-3xl font-semibold text-lime tabular" data-testid="build-total">
            {formatIDR(total)}
          </p>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[0.68rem] text-faint uppercase">
              <span>Est. load ~{draw} W</span>
              <span>{psuRated ? `PSU ${psuRated} W` : `rec. ${recommended} W`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className={cx("h-full rounded-full", !psuRated ? "bg-blue" : draw > psuRated ? "bg-rose" : recommended > psuRated ? "bg-amber" : "bg-lime")}
                style={{ width: `${Math.min(100, (draw / (psuRated ?? recommended)) * 100)}%` }}
              />
            </div>
          </div>

          {!isReady ? null : isLoggedIn ? (
            <button type="button" onClick={addAll} disabled={buyable.length === 0 || errors > 0} className={cx(buttonVariants.primary, "w-full py-3")} data-testid="build-add-all">
              {errors > 0 ? "Fix compatibility first" : `Add ${buyable.length || ""} to cart`}
            </button>
          ) : (
            <Link href="/login?next=/build" className={cx(buttonVariants.secondary, "w-full")}>
              Log in to buy this build
            </Link>
          )}
        </Card>

        <section id="build-checks" className="scroll-mt-24 space-y-2" aria-label="Compatibility" aria-live="polite" data-testid="build-checks">
          <h2 className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Compatibility</h2>
          {checks.length === 0 ? (
            <p className="text-sm text-dim">Pick a processor and motherboard to start checking.</p>
          ) : (
            checks.map((c) => (
              <div key={c.title} className={cx("rounded-xl border px-4 py-3", SEVERITY_STYLE[c.severity].box)} data-severity={c.severity}>
                <p className={cx("flex items-center gap-2 text-sm font-medium", SEVERITY_STYLE[c.severity].label)}>
                  <span className={cx("size-1.5 rounded-full", SEVERITY_STYLE[c.severity].dot)} aria-hidden />
                  {c.title}
                </p>
                <p className="mt-1 text-xs text-dim">{c.detail}</p>
              </div>
            ))
          )}
        </section>
      </aside>

      {/* On narrower screens the summary sits below all eight slots, so keep the verdict and
          total pinned to the bottom of the screen while picking parts. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-void/90 px-4 py-3 backdrop-blur-xl lg:hidden" data-testid="build-status-bar">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-lg font-semibold text-lime tabular">{formatIDR(total)}</p>
            <p className={cx("text-xs", errors ? "text-rose" : warnings ? "text-amber" : parts.length ? "text-lime" : "text-dim")}>
              {errors
                ? `${errors} compatibility ${errors === 1 ? "problem" : "problems"}`
                : warnings
                  ? `${warnings} ${warnings === 1 ? "warning" : "warnings"}`
                  : parts.length
                    ? "Everything fits"
                    : "Pick parts to start"}
            </p>
          </div>
          <a href="#build-checks" className={cx(buttonVariants.secondary, "shrink-0 px-4 py-2")}>
            Details ↓
          </a>
        </div>
      </div>
    </div>
  );
}
