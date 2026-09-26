import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/Guards";
import CartView from "@/components/cart/CartView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Cart", description: "Review the parts in your cart before checkout." };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Checkout · step 1" title="Your cart" />
      <ProtectedRoute>
        <CartView />
      </ProtectedRoute>
    </div>
  );
}
