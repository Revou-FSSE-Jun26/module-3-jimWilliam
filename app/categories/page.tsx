import type { Metadata } from "next";
import Link from "next/link";
import ProductImage from "@/components/product/ProductImage";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";
import { formatIDR } from "@/lib/format";
import { CATEGORY_ACCENT } from "@/lib/meta";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse RevoTech by category: processors, motherboards, memory and storage, graphics, power and cooling, peripherals.",
};

// Rendering strategy: ISR - categories change rarely, so prerender and refresh every 10 minutes.
export const revalidate = 600;

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([
    serverApi.categories({ revalidate: 600 }),
    serverApi.products({}, { revalidate: 600 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Browse" title="Categories">
        {categories.length} categories, {products.length} parts. Pick a shelf.
      </PageHeader>

      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="category-list">
        {categories.map((c) => {
          const items = products.filter((p) => p.category_id === c.category_id);
          const prices = items.map((p) => p.price);
          const accent = CATEGORY_ACCENT[c.category_id] ?? "#22d3ee";
          return (
            <li key={c.category_id}>
              <Card as={Link} href={`/products?category_id=${c.category_id}`} interactive accent={accent} className="flex h-full flex-col gap-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{c.category_name}</h2>
                    <p className="mt-1 text-sm text-dim first-letter:uppercase">{c.description}</p>
                  </div>
                  <span className="font-mono text-3xl tabular" style={{ color: accent }}>
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex -space-x-3">
                  {items.slice(0, 4).map((p) => (
                    <ProductImage
                      key={p.product_id}
                      product={p}
                      sizes="72px"
                      className="size-16 rounded-xl border-2 border-surface ring-1 ring-line"
                    />
                  ))}
                </div>

                <p className="mt-auto font-mono text-xs text-faint">
                  {prices.length ? (
                    <>
                      from <span className="text-ink">{formatIDR(Math.min(...prices))}</span>
                    </>
                  ) : (
                    "no products yet"
                  )}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
