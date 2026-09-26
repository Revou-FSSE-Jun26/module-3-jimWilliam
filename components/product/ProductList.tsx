"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CartSummary from "@/components/product/CartSummary";
import CategoryFilter from "@/components/product/CategoryFilter";
import ProductGrid from "@/components/product/ProductGrid";
import SearchBar from "@/components/product/SearchBar";
import { describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants } from "@/lib/classes";
import type { Category, Product } from "@/lib/types";

interface Props {
  /** first page of results, already fetched by the Server Component parent */
  products: Product[];
  categories: Pick<Category, "category_id" | "category_name">[];
}

/**
 * The interactive catalogue.
 *
 * - Typing filters the loaded list instantly (live search).
 * - Enter pushes ?search= into the URL with router.push, so results are shareable.
 * - Picking a category pushes ?category_id=.
 * - Whenever those URL params change, useSearchParams() picks it up and the effect refetches
 *   GET /products?search=&category_id= from the API.
 */
export default function ProductList({ products: initialProducts, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("category_id") ?? "";
  const key = `${search}|${categoryId}`;

  // What is typed in the box. Reset whenever the URL's search changes from elsewhere (e.g. the
  // header search) - adjusting state during render, as React recommends, not in an effect.
  const [query, setQuery] = useState(search);
  const [seenSearch, setSeenSearch] = useState(search);
  if (search !== seenSearch) {
    setSeenSearch(search);
    setQuery(search);
  }

  // Results fetched on the client, tagged with the query they belong to. Loading and error are
  // derived from that tag rather than stored: "loading" simply means no result for the current
  // params has landed yet. Until one does we show the server's results - never a stale flash.
  const [fetched, setFetched] = useState<{ key: string; products?: Product[]; error?: string } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api
      .products({ search: search || undefined, category_id: categoryId || undefined }, ac.signal)
      .then((products) => setFetched({ key, products }))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFetched({ key, error: describeError(e) });
      });
    return () => ac.abort();
  }, [key, search, categoryId]);

  const current = fetched?.key === key ? fetched : null;
  const loading = current === null;
  const error = current?.error ?? null;
  const base = current?.products ?? initialProducts;

  // live filter over whatever is loaded, before the user even presses Enter
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === search.toLowerCase()) return base;
    return base.filter(
      (p) => p.product_name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }, [base, query, search]);

  const pushParams = (next: { search?: string; category_id?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeCategory = categories.find((c) => String(c.category_id) === categoryId);
  const filtered = Boolean(search || categoryId);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <SearchBar
          id="catalog-search"
          value={query}
          onChange={setQuery}
          onSubmit={(value) => pushParams({ search: value })}
          placeholder="Search by name or spec — press Enter to search the catalogue"
        />
        <CategoryFilter value={categoryId} onChange={(id) => pushParams({ category_id: id })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-[0.14em] text-dim uppercase" aria-live="polite" data-testid="result-count">
          {`${visible.length} ${visible.length === 1 ? "result" : "results"}`}
          {search && (
            <>
              {" "}
              for <span className="text-cyan normal-case">“{search}”</span>
            </>
          )}
          {activeCategory && (
            <>
              {" "}
              in <span className="text-magenta normal-case">{activeCategory.category_name}</span>
            </>
          )}
          {loading && <span className="ml-2 animate-pulse-glow text-cyan">· syncing</span>}
        </p>
        {filtered && (
          <button type="button" className={buttonVariants.ghost} onClick={() => pushParams({ search: "", category_id: "" })}>
            Clear filters ✕
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="panel border-rose/40 px-5 py-4 text-sm text-rose">
          Could not refresh results: {error}
        </div>
      )}

      <CartSummary />

      <div className={loading && fetched ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <ProductGrid
          products={visible}
          categories={categories}
          emptyMessage={filtered || query ? "Nothing matches that search. Try a model number like 5070 or 9850X3D." : "The catalogue is empty."}
        />
      </div>
    </div>
  );
}
