import type { Metadata } from "next";
import { Suspense } from "react";
import ProductList from "@/components/product/ProductList";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = {
  title: "Products",
  description: "Every part in the RevoTech catalogue — search by model number or filter by category.",
};

// Rendering strategy: dynamic. Stock and prices change with every order, and the result set
// depends on ?search= and ?category_id=, so this page renders per request.
export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const search = first(sp.search);
  const category_id = first(sp.category_id);

  const [products, categories] = await Promise.all([
    serverApi.products({ search, category_id }, { cache: "no-store" }),
    serverApi.categories({ cache: "no-store" }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Catalogue" title="All products">
        Current-generation parts, priced in rupiah. Search by model number — try <span className="font-mono text-cyan">5070</span> or{" "}
        <span className="font-mono text-cyan">am5</span>.
      </PageHeader>
      <Suspense fallback={<SkeletonGrid />}>
        <ProductList products={products} categories={categories} />
      </Suspense>
    </div>
  );
}
