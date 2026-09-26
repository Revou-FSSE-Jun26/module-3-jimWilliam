/** Tiny className joiner - avoids pulling in clsx for one function. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Maps a typed flag to a Tailwind class string: a glowing cyan call-to-action when the
 * product can be bought, a muted, non-interactive look when it cannot.
 */
export function getButtonClasses(inStock: boolean): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition";
  return inStock
    ? `${base} bg-cyan text-void hover:shadow-[0_0_24px_-2px_var(--color-cyan)] hover:-translate-y-px active:translate-y-0 cursor-pointer`
    : `${base} cursor-not-allowed border border-line bg-surface-2 text-faint`;
}

export const buttonVariants = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-void transition hover:-translate-y-px hover:shadow-[0_0_24px_-2px_var(--color-cyan)] disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line-bright bg-surface-2/70 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-cyan hover:text-cyan disabled:pointer-events-none disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-dim transition hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-rose/40 bg-rose/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-rose transition hover:bg-rose hover:text-void disabled:pointer-events-none disabled:opacity-50",
} as const;

export const inputClasses =
  "w-full rounded-xl border border-line bg-void/70 px-3.5 py-2.5 text-sm text-ink transition placeholder:text-faint focus:border-cyan focus:outline-none focus:ring-3 focus:ring-cyan/15 aria-invalid:border-rose aria-invalid:focus:ring-rose/20";
