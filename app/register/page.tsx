import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import { PublicOnlyRoute } from "@/components/auth/Guards";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Register", description: "Create a RevoTech account to check out and track orders." };

export default function RegisterPage() {
  return (
    <PublicOnlyRoute>
      <AuthShell eyebrow="New account" title="Create an account" blurb="Save a cart, check out in one step, and follow every order from paid to delivered.">
        <RegisterForm />
      </AuthShell>
    </PublicOnlyRoute>
  );
}
