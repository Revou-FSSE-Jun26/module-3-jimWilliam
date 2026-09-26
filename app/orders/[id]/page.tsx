import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Guards";
import OrderDetailView from "@/components/orders/OrderDetailView";
import PageHeader from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id.padStart(4, "0")}` };
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const order = await serverApi.order(id, { cache: "no-store" }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Order detail" title={`Order #${String(order.order_id).padStart(4, "0")}`} />
      <ProtectedRoute>
        <OrderDetailView order={order} />
      </ProtectedRoute>
    </div>
  );
}
