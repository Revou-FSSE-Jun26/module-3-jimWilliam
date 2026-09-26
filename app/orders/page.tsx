import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/Guards";
import OrdersView from "@/components/orders/OrdersView";
import PageHeader from "@/components/ui/PageHeader";
import { serverApi } from "@/lib/api.server";

export const metadata: Metadata = { title: "My orders", description: "Track your RevoTech orders from paid to delivered." };

// Rendering strategy: dynamic - orders change the moment someone checks out.
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await serverApi.orders({}, { cache: "no-store" });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Account" title="My orders" />
      <ProtectedRoute>
        <OrdersView orders={orders} />
      </ProtectedRoute>
    </div>
  );
}
