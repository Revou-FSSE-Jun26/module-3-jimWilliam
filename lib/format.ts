import type { Availability, OrderStatus, Product } from "@/lib/types";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/** Rp 13.750.000 */
export const formatIDR = (value: number) => idr.format(value);

/** Rp 13,75 jt - for tight spaces like the header cart pill and HUD tiles */
export function formatIDRCompact(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return formatIDR(value);
}

export const LOW_STOCK_THRESHOLD = 10;

export function availabilityOf(p: Pick<Product, "is_active" | "stock_quantity">): Availability {
  if (!p.is_active) return "unavailable";
  if (p.stock_quantity <= 0) return "out-of-stock";
  if (p.stock_quantity < LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
  unavailable: "Unavailable",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Dates and times: see formatters() in lib/settings.ts - they follow the store's time zone setting.

/** Sentence-case the lowercase Indonesian spec strings the Flask seed uses. */
export const specText = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
