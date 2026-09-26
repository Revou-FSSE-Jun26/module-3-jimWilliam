"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Lives in app/products/layout.tsx. Because that layout stays mounted while you move between
 * /products and /products/[id], this component's state survives the navigation - the session
 * timer keeps counting instead of resetting, and "mounted" is logged exactly once. That is the
 * visible proof the nested layout is not re-rendered from scratch.
 */
export default function CatalogRail() {
  const pathname = usePathname();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    console.info("[products/layout] mounted");
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(t);
      console.info("[products/layout] unmounted");
    };
  }, []);

  const onDetail = pathname !== "/products";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="border-b border-line/70 bg-surface/40 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-4 px-4 font-mono text-[0.7rem] tracking-[0.12em] uppercase sm:px-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-faint">
            <li>
              <Link href="/" className="hover:text-cyan">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              {onDetail ? (
                <Link href="/products" className="hover:text-cyan">
                  Products
                </Link>
              ) : (
                <span className="text-dim" aria-current="page">
                  Products
                </span>
              )}
            </li>
            {onDetail && (
              <>
                <li aria-hidden>/</li>
                <li className="text-dim" aria-current="page">
                  Detail
                </li>
              </>
            )}
          </ol>
        </nav>
        <p className="flex items-center gap-2 text-faint" title="Keeps counting across /products and /products/[id] - the layout is never remounted">
          <span className="size-1.5 animate-pulse-glow rounded-full bg-lime" aria-hidden />
          <span className="hidden sm:inline">catalogue session</span>
          <span className="text-dim tabular" data-testid="layout-timer">
            {mm}:{ss}
          </span>
        </p>
      </div>
    </div>
  );
}
