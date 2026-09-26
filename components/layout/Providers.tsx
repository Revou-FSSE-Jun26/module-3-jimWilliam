"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import ThemeSync from "@/components/layout/ThemeSync";
import type { SiteSettings } from "@/lib/settings";

export default function Providers({ settings, children }: { settings: SiteSettings; children: ReactNode }) {
  return (
    <SettingsProvider value={settings}>
      <AuthProvider>
        <CartProvider>
          {children}
          <ThemeSync />
          <Toaster
            position="bottom-right"
            gutter={10}
            toastOptions={{
              duration: 3500,
              className: "!font-sans !text-sm",
              style: {
                background: "var(--color-surface-2)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-line-bright)",
                borderRadius: "14px",
                padding: "12px 14px",
                boxShadow: "var(--shadow-toast)",
              },
              success: { iconTheme: { primary: "#a3e635", secondary: "#060914" } },
              error: { iconTheme: { primary: "#fb7185", secondary: "#060914" }, duration: 5000 },
            }}
          />
        </CartProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
