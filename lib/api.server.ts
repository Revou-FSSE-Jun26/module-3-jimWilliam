import "server-only";

import { ApiError, apiBase } from "@/lib/api";
import type { AboutContent, HomeContent } from "@/lib/content";
import type { SiteSettings } from "@/lib/settings";
import { TAG } from "@/lib/server/cache-tags";
import * as store from "@/lib/server/store";
import type { Category, CategoryDetail, Order, OrderDetail, Product } from "@/lib/types";

type FetchOptions = { cache?: RequestCache; revalidate?: number };

/**
 * GET helper for Server Components: native fetch with async/await, a res.ok check that throws
 * a typed ApiError, and per-call caching so each page can choose its rendering strategy.
 */
async function get<T>(path: string, { cache, revalidate }: FetchOptions = {}): Promise<T> {
  // During `next build` nothing is listening on our own /api yet, so the statically generated
  // pages (home, categories, product detail) read the same store the route handlers use.
  // At request time this branch is never taken - real HTTP, real failures, real error.tsx.
  if (process.env.NEXT_PHASE === "phase-production-build" && isOwnApi()) {
    return readLocal<T>(path);
  }

  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      // server-only credential; never shipped to the browser (no NEXT_PUBLIC_ prefix)
      ...(process.env.API_SECRET_KEY && { "x-api-key": process.env.API_SECRET_KEY }),
    },
    // Only pass what the caller asked for: a per-fetch revalidate lower than the route's own
    // would silently drag an ISR page down to dynamic rendering.
    ...(cache && { cache }),
    // tagged by resource, so a write through the API can expire exactly the pages that show it
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

/** True when the configured API is this deployment itself rather than an external backend. */
function isOwnApi() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || base.startsWith("/")) return true;
  const own = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean);
  try {
    const host = new URL(base).host;
    return host.startsWith("localhost") || host.startsWith("127.0.0.1") || own.includes(host);
  } catch {
    return false;
  }
}

async function readLocal<T>(path: string): Promise<T> {
  const url = new URL(path, "http://local");
  const [, resource, rawId] = url.pathname.split("/");
  const id = rawId ? Number(rawId) : undefined;
  const q = url.searchParams;

  const result = await (resource === "settings"
      ? store.getSettings()
      : resource === "content"
      ? store.getContent(rawId)
      : resource === "products"
      ? id
        ? store.getProduct(id)
        : store.listProducts({ search: q.get("search"), category_id: q.get("category_id") })
      : resource === "categories"
        ? id
          ? store.getCategory(id)
          : store.listCategories()
        : resource === "orders"
          ? id
            ? store.getOrder(id)
            : store.listOrders({ user_id: q.get("user_id") })
          : Promise.resolve({ status: 404, body: { error: `unknown resource ${resource}` } }));

  if (result.status >= 400) throw new ApiError(result.status, result.body as { error: string });
  return result.body as T;
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
  orders: (params: { user_id?: number } = {}, opts?: FetchOptions) => get<Order[]>(`/orders${query(params)}`, opts),
  order: (id: string | number, opts?: FetchOptions) => get<OrderDetail>(`/orders/${id}`, opts),
  home: (opts?: FetchOptions) => get<HomeContent>("/content/home", opts),
  settings: (opts?: FetchOptions) => get<SiteSettings>("/settings", opts),
  about: (opts?: FetchOptions) => get<AboutContent>("/content/about", opts),
};
