import type { ReactNode } from "react";

/** Split layout shared by /login and /register. */
export default function AuthShell({ eyebrow, title, blurb, children }: { eyebrow: string; title: string; blurb: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
      <div className="hidden space-y-4 lg:block">
        <p className="font-mono text-xs tracking-[0.24em] text-cyan uppercase">
          <span className="text-faint">{"//"}</span> {eyebrow}
        </p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">{title}</h1>
        <p className="max-w-sm text-dim">{blurb}</p>
        <div className="relative mt-8 h-40 max-w-sm">
          <div className="absolute inset-0 rounded-3xl border border-cyan/30 bg-cyan/5 transform-[perspective(600px)_rotateX(55deg)]" />
          <div className="bg-cyber-grid absolute inset-0 rounded-3xl opacity-60 transform-[perspective(600px)_rotateX(55deg)]" />
        </div>
      </div>
      <div className="panel p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold lg:hidden">{title}</h1>
        {children}
      </div>
    </div>
  );
}
