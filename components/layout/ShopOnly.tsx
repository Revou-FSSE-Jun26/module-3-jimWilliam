"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminPath } from "@/lib/theme";

/** Storefront chrome (the footer) that the full-width admin area leaves out. */
export default function ShopOnly({ children }: { children: ReactNode }) {
  return isAdminPath(usePathname()) ? null : children;
}
