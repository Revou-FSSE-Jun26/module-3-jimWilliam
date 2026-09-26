"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSignOut } from "@/hooks/useSignOut";
import { api } from "@/lib/api.client";
import { cx } from "@/lib/classes";
import { formatIDR } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const OPEN_EVENT = "revotech:open-palette";

/** Anything in the app can open the palette without prop-drilling a setter. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Entry {
  id: string;
  group: "Go to" | "Products" | "Categories" | "Account";
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/**
 * Subsequence fuzzy match: every character of the query must appear in order. Contiguous runs
 * and matches at word starts score higher, so "5070" finds the RTX 5070 before anything else
 * and "b850" jumps straight to the MSI board.
 */
function fuzzyScore(text: string, query: string): number | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return 0;
  if (t.includes(q)) return 1000 - t.indexOf(q); // exact substring wins outright
  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 3 + (found === 0 || t[found - 1] === " " ? 5 : 0);
    ti = found + 1;
  }
  return score;
}

export default function CommandPalette() {
  const router = useRouter();
  const { isLoggedIn, isAdmin } = useAuth();
  const signOut = useSignOut();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<{ products: Product[]; categories: Category[] } | null>(null);

  const show = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  // open/close the native <dialog>: showModal() gives us focus trapping, Esc, an inert
  // background and focus restoration on close, all from the browser
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      inputRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  // Ctrl/Cmd+K anywhere, plus the header button's event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) setOpen(false);
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [show]);

  // load the catalogue the first time the palette opens, then keep it
  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    Promise.all([api.products(), api.categories()])
      .then(([products, categories]) => {
        if (!cancelled) setCatalog({ products, categories });
      })
      .catch(() => {
        if (!cancelled) setCatalog({ products: [], categories: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, catalog]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const entries = useMemo<Entry[]>(() => {
    const nav: Entry[] = [
      { id: "nav-home", group: "Go to", label: "Home", run: () => go("/") },
      { id: "nav-products", group: "Go to", label: "All products", keywords: "catalogue shop", run: () => go("/products") },
      { id: "nav-categories", group: "Go to", label: "Categories", run: () => go("/categories") },
      { id: "nav-build", group: "Go to", label: "Build planner", keywords: "pc rig compatibility", run: () => go("/build") },
      ...(isLoggedIn
        ? [
            { id: "nav-cart", group: "Go to" as const, label: "Cart", keywords: "basket checkout", run: () => go("/cart") },
            ...(isAdmin ? [] : [{ id: "nav-orders", group: "Go to" as const, label: "My orders", run: () => go("/orders") }]),
          ]
        : []),
      ...(isAdmin
        ? [
            { id: "nav-dash", group: "Go to" as const, label: "Dashboard · products", keywords: "admin", run: () => go("/dashboard") },
            { id: "nav-dash-cat", group: "Go to" as const, label: "Dashboard · categories", keywords: "admin", run: () => go("/dashboard/categories") },
            { id: "nav-dash-ord", group: "Go to" as const, label: "Dashboard · orders", keywords: "admin manage ship status", run: () => go("/dashboard/orders") },
            { id: "nav-dash-set", group: "Go to" as const, label: "Dashboard · settings", keywords: "admin logo name time zone", run: () => go("/dashboard/settings") },
          ]
        : []),
    ];
    const account: Entry[] = isLoggedIn
      ? [
          {
            id: "acc-logout",
            group: "Account",
            label: "Log out",
            run: () => {
              setOpen(false);
              signOut();
            },
          },
        ]
      : [
          { id: "acc-login", group: "Account", label: "Log in", run: () => go("/login") },
          { id: "acc-register", group: "Account", label: "Create an account", keywords: "register sign up", run: () => go("/register") },
        ];
    const products: Entry[] = (catalog?.products ?? []).map((p) => ({
      id: `p-${p.product_id}`,
      group: "Products",
      label: p.product_name,
      hint: formatIDR(p.price),
      keywords: p.description ?? "",
      run: () => go(`/products/${p.product_id}`),
    }));
    const categories: Entry[] = (catalog?.categories ?? []).map((c) => ({
      id: `c-${c.category_id}`,
      group: "Categories",
      label: c.category_name,
      hint: "category",
      keywords: c.description ?? "",
      run: () => go(`/products?category_id=${c.category_id}`),
    }));
    return [...nav, ...products, ...categories, ...account];
  }, [catalog, isLoggedIn, isAdmin, go, signOut]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // with no query show navigation, then a taste of the catalogue
      return [...entries.filter((e) => e.group !== "Products"), ...entries.filter((e) => e.group === "Products").slice(0, 5)];
    }
    return entries
      .map((e) => {
        const s = Math.max(fuzzyScore(e.label, query) ?? -1, (fuzzyScore(e.keywords ?? "", query) ?? -1) - 50);
        return { e, s };
      })
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((r) => r.e);
  }, [entries, query]);

  const clampedActive = Math.min(active, Math.max(0, results.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (Math.min(i, results.length - 1) + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (Math.min(i, results.length - 1) - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[clampedActive]?.run();
    } else if (e.key === "Tab") {
      // keep focus on the input; arrows are how you move through results
      e.preventDefault();
    }
  };

  // keep the highlighted option scrolled into view
  useEffect(() => {
    document.getElementById(`cmd-${results[clampedActive]?.id}`)?.scrollIntoView({ block: "nearest" });
  }, [clampedActive, results]);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) setOpen(false); // click on the backdrop
      }}
      aria-labelledby="cmd-title"
      className="m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line-bright bg-surface/95 p-0 text-ink shadow-[0_40px_120px_-30px_var(--color-cyan)] backdrop-blur-xl backdrop:bg-void/70 backdrop:backdrop-blur-sm"
    >
      <h2 id="cmd-title" className="sr-only">
        Command palette
      </h2>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <span className="font-mono text-cyan" aria-hidden>
          ❯
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a product, category or page…"
          className="h-14 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-faint"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          aria-activedescendant={results[clampedActive] ? `cmd-${results[clampedActive].id}` : undefined}
          aria-autocomplete="list"
          data-testid="command-input"
        />
        <kbd className="rounded border border-line-bright px-1.5 py-0.5 font-mono text-[0.65rem] text-faint">esc</kbd>
      </div>

      <ul id="cmd-list" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
        {results.length === 0 && (
          <li className="px-3 py-10 text-center text-sm text-dim">
            {catalog ? `Nothing matches “${query}”.` : "Loading catalogue…"}
          </li>
        )}
        {results.map((r, i) => {
          const header = i === 0 || results[i - 1].group !== r.group ? r.group : null;
          return (
            <li key={r.id} role="presentation">
              {header && (
                <p className="px-3 pt-3 pb-1.5 font-mono text-[0.62rem] tracking-[0.2em] text-faint uppercase" role="presentation">
                  {header}
                </p>
              )}
              <div
                id={`cmd-${r.id}`}
                role="option"
                aria-selected={i === clampedActive}
                onMouseMove={() => setActive(i)}
                onClick={() => r.run()}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm",
                  i === clampedActive ? "bg-cyan/10 text-cyan" : "text-ink"
                )}
              >
                <span className="truncate">{r.label}</span>
                {r.hint && <span className="shrink-0 font-mono text-xs text-dim tabular">{r.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-mono text-[0.65rem] text-faint">
        <span>↑↓ move</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </dialog>
  );
}
