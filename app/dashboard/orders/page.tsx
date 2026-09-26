import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import OrdersTable from "@/components/dashboard/OrdersTable";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = { title: "Orders · Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardOrdersPage() {
  const orders = await serverApi.orders({}, { cache: "no-store" });
  return (
    <RequirePermission permission="orders:manage">
      <PageHeader eyebrow="Admin" title="Orders">
        Every order from every customer. Move them along — paid, shipped, delivered — cancel them, or fix a shipping address.
      </PageHeader>
      <OrdersTable orders={orders} />
    </RequirePermission>
  );
}
