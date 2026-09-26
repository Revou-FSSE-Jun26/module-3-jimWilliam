import type { Metadata } from "next";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { PublicOnlyRoute } from "@/components/auth/Guards";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in", description: "Sign in to your RevoTech account." };

export default function LoginPage() {
  return (
    <PublicOnlyRoute>
      <AuthShell eyebrow="Access" title="Log in" blurb="Pick up where you left off — your cart is saved on this device.">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </PublicOnlyRoute>
  );
}
