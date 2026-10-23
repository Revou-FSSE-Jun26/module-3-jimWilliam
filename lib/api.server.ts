import "server-only";

import { ApiError, backendUrl } from "@/lib/api";
import type { AboutContent, HomeContent } from "@/lib/content";
import type { SiteSettings } from "@/lib/settings";
import { TAG } from "@/lib/server/cache-tags";
import type { Category, CategoryDetail, Product } from "@/lib/types";

type FetchOptions = { cache?: RequestCache; revalidate?: number };

/**
 * GET helper for Server Components: native fetch straight to the Flask API, a res.ok check
 * that throws a typed ApiError, and per-call caching so each page can choose its rendering
 * strategy. Only public data is read here - orders and profiles need the signed-in user's
 * token, so those pages fetch in the browser (lib/api.client.ts).
 */
async function get<T>(path: string, { cache, revalidate }: FetchOptions = {}): Promise<T> {
  const res = await fetch(`${backendUrl()}${path}`, {
    headers: {
      accept: "application/json",
      // server-only credential; never shipped to the browser (no NEXT_PUBLIC_ prefix)
      ...(process.env.API_SECRET_KEY && { "x-api-key": process.env.API_SECRET_KEY }),
    },
    // Only pass what the caller asked for: a per-fetch revalidate lower than the route's own
    // would silently drag an ISR page down to dynamic rendering.
    ...(cache && { cache }),
    // tagged by resource, so an admin's write can expire exactly the pages that show it
    // (app/api/revalidate, called by lib/api.client.ts after a successful write)
    next: { tags: tagsFor(path), ...(revalidate !== undefined && { revalidate }) },
  });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as T;
}

function tagsFor(path: string): string[] {
  const [, resource, key] = path.split(/[/?]/);
  if (resource === "products" || resource === "categories") return [TAG.catalog];
  if (resource === "content" && key) return [TAG.content(key)];
  if (resource === "settings") return [TAG.settings];
  return [];
}

function query(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const serverApi = {
  products: (params: { search?: string; category_id?: string | number } = {}, opts?: FetchOptions) =>
    get<Product[]>(`/products${query(params)}`, opts),
  product: (id: string | number, opts?: FetchOptions) => get<Product>(`/products/${id}`, opts),
  categories: (opts?: FetchOptions) => get<(Category & { product_count?: number })[]>("/categories", opts),
  category: (id: string | number, opts?: FetchOptions) => get<CategoryDetail>(`/categories/${id}`, opts),
  home: (opts?: FetchOptions) => get<HomeContent>("/content/home", opts),
  settings: (opts?: FetchOptions) => get<SiteSettings>("/settings", opts),
  about: (opts?: FetchOptions) => get<AboutContent>("/content/about", opts),
};
