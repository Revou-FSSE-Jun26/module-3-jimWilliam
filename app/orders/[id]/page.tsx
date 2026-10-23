import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Guards";
import OrderDetailView from "@/components/orders/OrderDetailView";
import PageHeader from "@/components/ui/PageHeader";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id.padStart(4, "0")}` };
}

// The order itself loads in the browser with the user's token - the API only shows it to its
// owner or to staff - so the server renders the shell and the guard.
export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Order detail" title={`Order #${String(orderId).padStart(4, "0")}`} />
      <ProtectedRoute>
        <OrderDetailView id={orderId} />
      </ProtectedRoute>
    </div>
  );
}
