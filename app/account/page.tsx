import type { Metadata } from "next";
import AccountForm from "@/components/account/AccountForm";
import { ProtectedRoute } from "@/components/auth/Guards";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <ProtectedRoute>
        <PageHeader eyebrow="Account" title="Your account">
          Your name, contact details and shipping address — and your password.
        </PageHeader>
        <AccountForm />
      </ProtectedRoute>
    </div>
  );
}
