"use client";

import { useEffect, useState, type ReactNode } from "react";
import AboutEditor from "@/components/admin/AboutEditor";
import AdminBar from "@/components/admin/AdminBar";
import HomeEditor from "@/components/admin/HomeEditor";
import { EditProductForm } from "@/components/dashboard/ProductForms";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeError } from "@/lib/api";
import { contentApi } from "@/lib/api.client";
import type { Category, Product } from "@/lib/types";

/*
 * The admin bars for pages that are Server Components. A server page can't hand a render
 * function to a client component, so each bar is wrapped here with its editor.
 */

/**
 * Loads what the API has right now before showing an editor - never the content the page was
 * rendered with, which can be a cached copy older than the store (after a server restart, say).
 * Editing a stale copy and saving it would silently overwrite newer content.
 */
function Fresh<T>({ load, children }: { load: () => Promise<T>; children: (data: T) => ReactNode }) {
  const [state, setState] = useState<{ data?: T; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ data }))
      .catch((e) => !cancelled && setState({ error: describeError(e) }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!state) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (state.error !== undefined) return <p className="text-sm text-rose">{state.error}</p>;
  return <>{children(state.data as T)}</>;
}

export function HomeAdminBar({ products }: { products: Pick<Product, "product_id" | "product_name" | "is_active">[] }) {
  return (
    <AdminBar label="Homepage" action="Edit homepage" title="Edit homepage" testId="home-admin" permission="content:write" links={[{ href: "/dashboard", label: "Dashboard" }]}>
      {(done, cancel) => <Fresh load={contentApi.home}>{(content) => <HomeEditor initial={content} products={products} onSaved={done} onCancel={cancel} />}</Fresh>}
    </AdminBar>
  );
}

export function AboutAdminBar() {
  return (
    <AdminBar label="About page" action="Edit about page" title="Edit about page" testId="about-admin" permission="content:write">
      {(done, cancel) => <Fresh load={contentApi.about}>{(content) => <AboutEditor initial={content} onSaved={done} onCancel={cancel} />}</Fresh>}
    </AdminBar>
  );
}

export function ProductAdminBar({ productId, categories }: { productId: number; categories: Pick<Category, "category_id" | "category_name">[] }) {
  return (
    <AdminBar
      label={`Product #${productId}`}
      action="Edit product"
      title="Edit product"
      testId="product-admin"
      permission="products:write"
      links={[{ href: "/dashboard", label: "All products" }]}
    >
      {/* EditProductForm already loads the product from GET /products/[id] itself */}
      {(done, cancel) => <EditProductForm productId={productId} categories={categories} onUpdated={done} onCancel={cancel} />}
    </AdminBar>
  );
}
