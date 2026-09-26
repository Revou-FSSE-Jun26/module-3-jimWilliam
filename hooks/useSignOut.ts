"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { toast } from "@/lib/toast";

/**
 * The one way to sign out. Ending the session also empties the cart - otherwise the badge and
 * total stayed in the header after logout, and the next person to sign in on the same browser
 * would inherit the previous user's cart.
 */
export function useSignOut() {
  const { logout } = useAuth();
  const { clearCart } = useCart();
  const router = useRouter();

  return useCallback(() => {
    clearCart();
    logout();
    toast.success("Signed out");
    router.push("/");
  }, [clearCart, logout, router]);
}
