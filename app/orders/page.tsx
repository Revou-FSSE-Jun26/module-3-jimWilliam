import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/Guards";
import OrdersView from "@/components/orders/OrdersView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My orders", description: "Track your orders from paid to delivered." };

// Rendering strategy: the shell is static; the orders load in the browser with the user's token
// (the API only shows an account its own orders), so they are always current.
export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Account" title="My orders" />
      <ProtectedRoute>
        <OrdersView />
      </ProtectedRoute>
    </div>
  );
}
