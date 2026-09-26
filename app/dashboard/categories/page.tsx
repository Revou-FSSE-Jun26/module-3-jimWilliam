import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import CategoryManager from "@/components/dashboard/CategoryManager";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = { title: "Categories · Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardCategoriesPage() {
  const categories = await serverApi.categories({ cache: "no-store" });
  return (
    <RequirePermission permission="categories:write">
      <PageHeader eyebrow="Admin" title="Categories">
        A category can only be deleted once no products belong to it.
      </PageHeader>
      <CategoryManager initialCategories={categories} />
    </RequirePermission>
  );
}
