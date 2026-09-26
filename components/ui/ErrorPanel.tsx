"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "@/lib/classes";

/**
 * Shared body for every error.tsx boundary. Next 16 hands error boundaries `retry()`, which
 * re-fetches and re-renders the segment (the older `reset()` only re-rendered it).
 */
export default function ErrorPanel({
  error,
  retry,
  title = "Signal lost",
  what = "this page",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
  what?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-xl place-items-center px-4 py-24 text-center" role="alert" data-testid="error-boundary">
      <div className="panel w-full space-y-5 border-rose/30 px-8 py-10">
        <p className="font-mono text-xs tracking-[0.3em] text-rose uppercase">{"// "}error</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-dim">
          We couldn&apos;t load {what}. The catalogue service may be down or slow — your cart and session are safe.
        </p>
        {/* In production React replaces server error messages with a generic "Minified React
            error" string, so only show the message while developing; the digest is what
            matches the entry in the server logs. */}
        {(process.env.NODE_ENV === "development" || error.digest) && (
          <p className="rounded-lg border border-line bg-void/60 px-3 py-2 font-mono text-xs wrap-break-word text-faint">
            {process.env.NODE_ENV === "development" && (error.message || "Unknown error")}
            {error.digest && <span className="block pt-1">Reference {error.digest}</span>}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button type="button" onClick={() => retry()} className={buttonVariants.primary}>
            Try again
          </button>
          <Link href="/" className={buttonVariants.secondary}>
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
