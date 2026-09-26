"use client";

import { cx } from "@/lib/classes";

/** Controlled +/- stepper, clamped to [min, max]. */
export default function QuantityCounter({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "md",
  label = "Quantity",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  const btn = cx(
    "grid place-items-center font-mono text-dim transition hover:bg-surface-3 hover:text-cyan disabled:pointer-events-none disabled:opacity-30",
    size === "sm" ? "size-7 text-sm" : "size-9"
  );
  return (
    <div
      className={cx("inline-flex items-center overflow-hidden rounded-xl border border-line bg-void/60", disabled && "opacity-50")}
      role="group"
      aria-label={label}
    >
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        −
      </button>
      <output className={cx("min-w-8 text-center font-mono text-ink tabular", size === "sm" ? "text-xs" : "text-sm")} aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
