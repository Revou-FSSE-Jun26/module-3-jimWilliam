import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import ProductManager from "@/components/dashboard/ProductManager";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [products, categories, orders] = await Promise.all([
    serverApi.products({}, { cache: "no-store" }),
    serverApi.categories({ cache: "no-store" }),
    serverApi.orders({}, { cache: "no-store" }),
  ]);

  return (
    <RequirePermission permission="products:write">
      <PageHeader eyebrow="Admin" title="Dashboard">
        Stock, revenue and the full product catalogue.
      </PageHeader>
      <ProductManager initialProducts={products} categories={categories} orders={orders} />
    </RequirePermission>
  );
}
