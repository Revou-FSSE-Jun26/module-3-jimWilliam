import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/Guards";
import AllOrders from "@/components/dashboard/AllOrders";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Orders · Dashboard", robots: { index: false } };

export default function DashboardOrdersPage() {
  return (
    <RequirePermission permission="orders:manage">
      <PageHeader eyebrow="Admin" title="Orders">
        Every order from every customer. Move them along — paid, shipped, delivered — cancel them, or fix a shipping address.
      </PageHeader>
      <AllOrders />
    </RequirePermission>
  );
}
