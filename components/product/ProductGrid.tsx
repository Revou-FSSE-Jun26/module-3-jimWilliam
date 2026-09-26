import ProductCard from "@/components/product/ProductCard";
import type { Category, Product } from "@/lib/types";

/**
 * Renders any Product[] with a single .map() - no hardcoded cards anywhere in the app.
 * Works from both Server Components (home page) and Client Components (the filtered list).
 */
export default function ProductGrid({
  products,
  categories = [],
  priorityCount = 4,
  emptyMessage = "No products match.",
  readOnly = false,
  columns = 4,
}: {
  readOnly?: boolean;
  columns?: 4 | 5;
  products: Product[];
  categories?: Pick<Category, "category_id" | "category_name">[];
  priorityCount?: number;
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="panel grid place-items-center gap-2 px-6 py-16 text-center" data-testid="empty-products">
        <p className="font-mono text-sm tracking-[0.2em] text-faint uppercase">{"// "}no signal</p>
        <p className="text-dim">{emptyMessage}</p>
      </div>
    );
  }

  const nameOf = new Map(categories.map((c) => [c.category_id, c.category_name]));

  return (
    <div
      className={
        columns === 5
          ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      }
      data-testid="product-grid"
    >
      {products.map((product, i) => (
        <ProductCard
          key={product.product_id}
          product={product}
          categoryName={nameOf.get(product.category_id)}
          priority={i < priorityCount}
          index={i}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
