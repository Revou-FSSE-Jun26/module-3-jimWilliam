"use client";

import { useEffect, useState } from "react";
import AddProductForm, { type FormState } from "@/components/dashboard/AddProductForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { toast } from "@/lib/toast";
import type { Category, Product } from "@/lib/types";

type Cats = Pick<Category, "category_id" | "category_name">[];

/** POST /products. 201 -> hand the new product up; 400 -> show the Flask { error } as a form error. */
export function CreateProductForm({ categories, onCreated, onCancel }: { categories: Cats; onCreated: (p: Product) => void; onCancel: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);

  return (
    <AddProductForm
      categories={categories}
      submitLabel="Create product"
      serverError={serverError}
      onCancel={onCancel}
      onSubmit={async (input) => {
        setServerError(null);
        try {
          const res = await api.createProduct(input); // fetch, method POST, Content-Type: application/json
          toast.success(`Created ${res.product.product_name}`);
          onCreated(res.product);
        } catch (e) {
          setServerError(describeError(e));
          toast.error(e);
        }
      }}
    />
  );
}

const toForm = (p: Product): FormState => ({
  product_name: p.product_name,
  category_id: String(p.category_id),
  price: String(p.price),
  stock_quantity: String(p.stock_quantity),
  description: p.description ?? "",
  is_active: p.is_active,
  official_url: p.official_url ?? "",
  overview: p.overview ?? "",
  overview_source: p.overview_source ?? null,
  images: p.images ?? [],
  specs: p.specs ?? [],
  // shown only when the specs came from somewhere other than the official page
  specs_url: p.specs_source && p.specs_source !== p.official_url ? p.specs_source : "",
});

/**
 * Loads the current product with GET /products/[id] (so it edits what the server has, not a
 * possibly stale table row), then PUT /products/[id]. 404 is shown as a form-level error.
 */
export function EditProductForm({
  productId,
  categories,
  onUpdated,
  onCancel,
}: {
  productId: number;
  categories: Cats;
  onUpdated: (p: Product) => void;
  onCancel: () => void;
}) {
  const [loaded, setLoaded] = useState<{ id: number; product?: Product; error?: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .product(productId)
      .then((product) => !cancelled && setLoaded({ id: productId, product }))
      .catch((e) => !cancelled && setLoaded({ id: productId, error: e instanceof ApiError && e.status === 404 ? "This product no longer exists." : describeError(e) }));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const current = loaded?.id === productId ? loaded : null;

  if (!current) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" aria-busy>
        <Skeleton className="h-16 sm:col-span-2" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-24 sm:col-span-2" />
      </div>
    );
  }
  if (current.error || !current.product) {
    return (
      <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose" data-testid="product-form-error">
        {current.error}
      </p>
    );
  }

  return (
    <AddProductForm
      key={productId}
      categories={categories}
      initial={toForm(current.product)}
      submitLabel="Save changes"
      serverError={serverError}
      onCancel={onCancel}
      onSubmit={async (input) => {
        setServerError(null);
        try {
          const res = await api.updateProduct(productId, input);
          toast.success(`Saved ${res.product.product_name}`);
          onUpdated(res.product);
        } catch (e) {
          setServerError(e instanceof ApiError && e.status === 404 ? "This product no longer exists." : describeError(e));
          toast.error(e);
        }
      }}
    />
  );
}
