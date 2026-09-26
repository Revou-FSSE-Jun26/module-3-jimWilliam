import type { ReactNode } from "react";
import { cx } from "@/lib/classes";
import type { Availability, OrderStatus } from "@/lib/types";
import { AVAILABILITY_LABEL, STATUS_LABEL } from "@/lib/format";

type Tone = "cyan" | "magenta" | "lime" | "amber" | "rose" | "blue" | "neutral";

const TONES: Record<Tone, string> = {
  cyan: "border-cyan/40 bg-cyan/10 text-cyan",
  magenta: "border-magenta/40 bg-magenta/10 text-magenta",
  lime: "border-lime/40 bg-lime/10 text-lime",
  amber: "border-amber/40 bg-amber/10 text-amber",
  rose: "border-rose/40 bg-rose/10 text-rose",
  blue: "border-blue/40 bg-blue/10 text-blue",
  neutral: "border-line-bright bg-surface-2 text-dim",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-medium uppercase tracking-widest whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 animate-pulse-glow rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const AVAILABILITY_TONE: Record<Availability, Tone> = {
  "in-stock": "lime",
  "low-stock": "amber",
  "out-of-stock": "rose",
  unavailable: "neutral",
};

export function AvailabilityBadge({ availability, className }: { availability: Availability; className?: string }) {
  return (
    <Badge tone={AVAILABILITY_TONE[availability]} dot={availability !== "unavailable"} className={className}>
      {AVAILABILITY_LABEL[availability]}
    </Badge>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "amber",
  paid: "cyan",
  shipped: "blue",
  delivered: "lime",
  cancelled: "rose",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
