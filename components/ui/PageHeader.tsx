import type { ReactNode } from "react";

/** Consistent top-of-page title block: mono eyebrow, big title, optional lede and actions. */
export default function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-xs tracking-[0.24em] text-cyan uppercase">
          <span className="text-faint">{"//"}</span> {eyebrow}
        </p>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {children && <div className="text-dim">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
