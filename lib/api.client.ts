import { ApiError, apiBase } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { AboutContent, HomeContent } from "@/lib/content";
import type { SiteSettings } from "@/lib/settings";
import type {
  Category,
  Order,
  OrderDetail,
  OrderInput,
  OrderStatus,
  Product,
  ProductInput,
  SpecRow,
  User,
  UserRecord,
} from "@/lib/types";

/**
 * Browser-side requests. Every call uses fetch with an explicit method and
 * Content-Type: application/json, and throws ApiError with the Flask error body on 4xx/5xx
 * so forms can show the backend's own message.
 */
/**
 * Who the browser thinks it is. The Flask API takes this from the JWT it signed; the mock API
 * reads this header (lib/server/auth.ts) and looks the role up, so the permission checks are
 * the same on both. Sent on every call - a GET needs it too where the data is staff-only.
 */
export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === "number" ? { "x-user-id": String(id) } : {};
  } catch {
    return {}; // private mode: the request goes out unauthenticated and the API answers 401
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", accept: "application/json", ...authHeaders() },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as T;
}

type Created<K extends string, T> = { message: string } & Record<K, T>;

export const api = {
  /* catalogue */
  products: (params: { search?: string; category_id?: string | number } = {}, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.category_id) q.set("category_id", String(params.category_id));
    const s = q.toString();
    return request<Product[]>(`/products${s ? `?${s}` : ""}`, { signal });
  },
  product: (id: number) => request<Product>(`/products/${id}`),
  createProduct: (data: ProductInput) =>
    request<Created<"product", Product>>("/products", { method: "POST", body: data }),
  updateProduct: (id: number, data: Partial<ProductInput>) =>
    request<Created<"product", Product>>(`/products/${id}`, { method: "PUT", body: data }),
  deleteProduct: (id: number) => request<{ message: string; id: number; withdrawn?: boolean }>(`/products/${id}`, { method: "DELETE" }),

  categories: (signal?: AbortSignal) => request<(Category & { product_count?: number })[]>("/categories", { signal }),
  createCategory: (data: { category_name: string; description?: string }) =>
    request<Created<"category", Category>>("/categories", { method: "POST", body: data }),
  updateCategory: (id: number, data: { category_name?: string; description?: string }) =>
    request<Created<"category", Category>>(`/categories/${id}`, { method: "PUT", body: data }),
  deleteCategory: (id: number) => request<{ message: string; id: number }>(`/categories/${id}`, { method: "DELETE" }),

  /* auth */
  register: (data: { username: string; email: string; password: string }) =>
    request<Created<"user", UserRecord>>("/users", { method: "POST", body: data }),
  login: (data: { email: string; password: string }) =>
    request<{ message: string; access_token: string; user: UserRecord }>("/auth/login", { method: "POST", body: data }),

  user: (id: number) => request<UserRecord>(`/users/${id}`),
  users: () => request<UserRecord[]>("/users"),
  /** profile fields for yourself; a superadmin may also send `role`, or a password without `current_password` */
  updateUser: (id: number, data: Partial<UserRecord> & { password?: string; current_password?: string }) =>
    request<Created<"user", UserRecord>>(`/users/${id}`, { method: "PUT", body: data }),

  /* orders */
  orders: (params: { user_id?: number } = {}) =>
    request<Order[]>(`/orders${params.user_id ? `?user_id=${params.user_id}` : ""}`),
  order: (id: number) => request<OrderDetail>(`/orders/${id}`),
  createOrder: (data: OrderInput) =>
    request<{ message: string; order: OrderDetail } | OrderDetail>("/orders", { method: "POST", body: data }),
  /** PUT /orders/[id] - same body and response as the Flask route */
  updateOrder: (id: number, data: { order_status?: OrderStatus; shipping_address?: string }) =>
    request<Created<"order", OrderDetail>>(`/orders/${id}`, { method: "PUT", body: data }),
};

export type { User };

/*
 * This app's own endpoints. They always live here, next to the storefront - even when
 * NEXT_PUBLIC_API_BASE_URL points the product API at the Flask backend - so they use
 * relative URLs rather than apiBase().
 */

export interface UploadResponse {
  message: string;
  /** e.g. /api/images/3f9a1c2b0d4e5f60.avif - always AVIF */
  url: string;
  bytes: number;
  source: { format: string; width: number; height: number; bytes: number };
}

/** POST /api/uploads - any supported image in, AVIF out. */
export async function uploadImage(file: Blob, name: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file, name);
  const res = await fetch("/api/uploads", { method: "POST", body: form, headers: authHeaders() }); // browser sets the multipart boundary
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as UploadResponse;
}

export interface OfficialPreview {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
}

/** GET /api/official-preview - the manufacturer's published summary for a product page. */
export async function officialPreview(url: string): Promise<OfficialPreview> {
  const res = await fetch(`/api/official-preview?url=${encodeURIComponent(url)}`, { headers: authHeaders() });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as OfficialPreview;
}

export interface SpecsResponse {
  url: string | null;
  specs: SpecRow[];
}

/** GET /api/official-specs - the spec table of a public product or spec page. */
export async function officialSpecs(url: string, name: string): Promise<SpecsResponse> {
  const res = await fetch(`/api/official-specs?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`, { headers: authHeaders() });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as SpecsResponse;
}

/** POST /api/official-specs - spec rows from HTML the admin copied out of a spec page. */
export async function specsFromHtml(html: string, name: string): Promise<SpecsResponse> {
  const res = await fetch("/api/official-specs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ html, name }),
  });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as SpecsResponse;
}

/*
 * Editable site content. Like uploads, these are this app's own endpoints (the Flask API has
 * no content table), so they always go to the relative /api.
 */
async function contentRequest<T>(key: "home" | "about", body?: T) {
  const res = await fetch(`/api/content/${key}`, {
    method: body ? "PUT" : "GET",
    headers: { "Content-Type": "application/json", accept: "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await ApiError.from(res);
  return res.json();
}

export const contentApi = {
  home: () => contentRequest<HomeContent>("home") as Promise<HomeContent>,
  saveHome: (data: HomeContent) => contentRequest("home", data) as Promise<{ message: string; content: HomeContent }>,
  about: () => contentRequest<AboutContent>("about") as Promise<AboutContent>,
  saveAbout: (data: AboutContent) => contentRequest("about", data) as Promise<{ message: string; content: AboutContent }>,
};

/* Store settings and logo - this app's own endpoints, like uploads and content. */
async function settingsRequest<T>(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/settings${path}`, {
    ...init,
    headers: { accept: "application/json", ...authHeaders(), ...(init.body && !(init.body instanceof FormData) && { "Content-Type": "application/json" }) },
  });
  if (!res.ok) throw await ApiError.from(res);
  return (await res.json()) as T;
}

export interface LogoPreview {
  svg: string;
  colours: string[];
  paths: number;
}

const logoForm = (file: Blob, name: string, apply: boolean) => {
  const form = new FormData();
  form.append("file", file, name);
  if (apply) form.append("apply", "1");
  return form;
};

export const settingsApi = {
  get: () => settingsRequest<SiteSettings>(""),
  save: (data: SiteSettings) => settingsRequest<{ message: string; settings: SiteSettings }>("", { method: "PUT", body: JSON.stringify(data) }),
  /** convert an image to an SVG logo without applying it */
  previewLogo: (file: Blob, name: string) => settingsRequest<LogoPreview>("/logo", { method: "POST", body: logoForm(file, name, false) }),
  applyLogo: (file: Blob, name: string) =>
    settingsRequest<LogoPreview & { settings: SiteSettings }>("/logo", { method: "POST", body: logoForm(file, name, true) }),
  resetLogo: () => settingsRequest<{ settings: SiteSettings }>("/logo", { method: "DELETE" }),
};
