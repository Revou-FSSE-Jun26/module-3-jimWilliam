import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/Guards";
import CheckoutView from "@/components/cart/CheckoutView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Checkout", description: "Confirm your shipping address and place your order." };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Checkout · step 2" title="Confirm your order" />
      <ProtectedRoute>
        <CheckoutView />
      </ProtectedRoute>
    </div>
  );
}
