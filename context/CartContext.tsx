"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { USER_STORAGE_KEY } from "@/context/AuthContext";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { CartItem, Product } from "@/lib/types";

const STORAGE_KEY = STORAGE_KEYS.cart;

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  isReady: boolean;
  addToCart: (product: Pick<Product, "product_id" | "product_name" | "price" | "stock_quantity">, quantity?: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  quantityOf: (productId: number) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  // restore the cart once on mount (see AuthContext for why this is an effect)
  useEffect(() => {
    try {
      // A cart only belongs to a signed-in session. If there is none (signed out, or a cart saved
      // before sign-out started clearing it), drop it rather than show someone else's items.
      if (!localStorage.getItem(USER_STORAGE_KEY)) localStorage.removeItem(STORAGE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* corrupt or unavailable storage - start empty */
    }
    setIsReady(true);

    // keep tabs in sync: signing out (or adding to the cart) in one tab updates the others
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setItems(e.newValue ? (JSON.parse(e.newValue) as CartItem[]) : []);
      } catch {
        setItems([]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist every change - but only once isReady is true. This must be state, not a ref: the
  // first commit runs this effect with the empty initial cart, and under Strict Mode effects run
  // twice, so a ref flipped by the hydration effect would let that empty cart overwrite the
  // saved one before the second hydration pass reads it back.
  useEffect(() => {
    if (!isReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, isReady]);

  // Every update below returns a new array and new item objects - never a mutation - so React
  // sees the change and the header badge, cart page and totals all re-render.
  const addToCart = useCallback<CartContextValue["addToCart"]>((product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.product_id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, product.stock_quantity);
        return prev.map((i) =>
          i.product_id === product.product_id ? { ...i, quantity: nextQty, stock_quantity: product.stock_quantity } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          price: product.price,
          stock_quantity: product.stock_quantity,
          quantity: Math.min(quantity, product.stock_quantity),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock_quantity)) } : i
      )
    );
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((n, i) => n + i.quantity, 0);
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      items,
      itemCount,
      total,
      isReady,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      quantityOf: (id) => items.find((i) => i.product_id === id)?.quantity ?? 0,
    };
  }, [items, isReady, addToCart, updateQuantity, removeFromCart, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
