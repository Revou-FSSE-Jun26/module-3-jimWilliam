"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateProductForm, EditProductForm } from "@/components/dashboard/ProductForms";
import StatsHUD from "@/components/dashboard/StatsHUD";
import ProductImage from "@/components/product/ProductImage";
import SearchBar from "@/components/product/SearchBar";
import { AvailabilityBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import StockMeter from "@/components/ui/StockMeter";
import { describeError } from "@/lib/api";
import { api } from "@/lib/api.client";
import { buttonVariants, cx } from "@/lib/classes";
import { availabilityOf, formatIDR } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Category, Order, Product } from "@/lib/types";

/**
 * Admin product table. Local state is the source of truth once the page has loaded, and every
 * change is immutable: create appends with a spread, edit replaces with .map(), delete removes
 * with .filter(). router.refresh() then re-runs the Server Component so anything else rendered
 * from GET /products catches up.
 */
export default function ProductManager({
  initialProducts,
  categories,
  orders,
}: {
  initialProducts: Product[];
  categories: Category[];
  orders: Order[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.category_id, c.category_name])), [categories]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.product_name.toLowerCase().includes(q) || (catName.get(p.category_id) ?? "").toLowerCase().includes(q)) : products;
  }, [products, query, catName]);

  const onCreated = (p: Product) => {
    setProducts((prev) => [...prev, p]);
    setCreating(false);
    router.refresh();
  };

  const onUpdated = (p: Product) => {
    setProducts((prev) => prev.map((x) => (x.product_id === p.product_id ? p : x)));
    setEditingId(null);
    router.refresh();
  };

  const onDelete = async (p: Product) => {
    setDeletingId(p.product_id);
    setRowError(null);
    try {
      await api.deleteProduct(p.product_id);
      setProducts((prev) => prev.filter((x) => x.product_id !== p.product_id));
      toast.success(`Deleted ${p.product_name}`);
      router.refresh();
    } catch (e) {
      // e.g. 409 "product cannot be deleted while it has active orders" - shown right on the row
      setRowError({ id: p.product_id, message: describeError(e) });
      toast.error(e);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <StatsHUD products={products} orders={orders} />

      <section className="panel overflow-hidden" aria-labelledby="products-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 id="products-title" className="text-lg font-semibold">
              Products
            </h2>
            <p className="font-mono text-xs text-faint">
              {visible.length} of {products.length}
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <SearchBar id="dash-search" compact value={query} onChange={setQuery} placeholder="Filter the table…" className="w-full max-w-xs" />
            <button type="button" onClick={() => setCreating(true)} className={buttonVariants.primary} data-testid="new-product">
              + New product
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm" data-testid="product-table">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[0.66rem] tracking-[0.14em] text-faint uppercase">
                <th scope="col" className="px-5 py-3 font-normal">Product</th>
                <th scope="col" className="px-3 py-3 font-normal">Category</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">Price</th>
                <th scope="col" className="w-36 px-3 py-3 font-normal">Stock</th>
                <th scope="col" className="px-3 py-3 font-normal">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const confirming = confirmingId === p.product_id;
                const error = rowError?.id === p.product_id ? rowError.message : null;
                return (
                  <tr key={p.product_id} className="border-b border-line/60 align-middle last:border-0 hover:bg-surface-2/40" data-testid="product-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage product={p} sizes="48px" className="size-11 shrink-0 rounded-lg border border-line" />
                        <div className="min-w-0">
                          <Link href={`/products/${p.product_id}`} className="font-medium hover:text-cyan" data-testid="row-name">
                            {p.product_name}
                          </Link>
                          <p className="font-mono text-[0.65rem] text-faint">#{p.product_id}</p>
                        </div>
                      </div>
                      {error && (
                        <p role="alert" className="mt-2 rounded-lg border border-rose/40 bg-rose/10 px-3 py-1.5 text-xs text-rose" data-testid="row-error">
                          {error}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-dim">{catName.get(p.category_id) ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-mono tabular" data-testid="row-price">
                      {formatIDR(p.price)}
                    </td>
                    <td className="px-3 py-3">
                      <StockMeter stock={p.stock_quantity} isActive={p.is_active} />
                    </td>
                    <td className="px-3 py-3">
                      <AvailabilityBadge availability={availabilityOf(p)} />
                    </td>
                    <td className="px-5 py-3">
                      {confirming ? (
                        <div className="flex items-center justify-end gap-2" data-testid="confirm-delete">
                          <span className="text-xs text-rose">Are you sure?</span>
                          <button type="button" onClick={() => onDelete(p)} disabled={deletingId === p.product_id} className={cx(buttonVariants.danger, "px-3 py-1.5")} data-testid="confirm-delete-yes">
                            {deletingId === p.product_id ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button type="button" onClick={() => setConfirmingId(null)} className={cx(buttonVariants.ghost, "px-2 py-1.5 text-xs")}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setEditingId(p.product_id)} className={cx(buttonVariants.ghost, "text-xs")} data-testid="edit-product">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRowError(null);
                              setConfirmingId(p.product_id);
                            }}
                            className={cx(buttonVariants.ghost, "text-xs hover:bg-rose/10 hover:text-rose")}
                            data-testid="delete-product"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} title="New product" testId="create-modal">
        <CreateProductForm categories={categories} onCreated={onCreated} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={editingId !== null} onClose={() => setEditingId(null)} title="Edit product" testId="edit-modal">
        {editingId !== null && <EditProductForm productId={editingId} categories={categories} onUpdated={onUpdated} onCancel={() => setEditingId(null)} />}
      </Modal>
    </div>
  );
}
