import { ApiError, apiBase } from "@/lib/api";
import type { AboutContent, HomeContent } from "@/lib/content";
import type { SiteSettings } from "@/lib/settings";
import { STORAGE_KEYS } from "@/lib/storage-keys";
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
 * Browser-side requests to the Flask API (through the /api rewrite, see lib/api.ts). Every
 * call uses fetch with an explicit method and Content-Type: application/json, sends the
 * signed-in user's token, and throws ApiError with the API's error body on 4xx/5xx so forms
 * can show the backend's own message.
 */

/** Fired when the API rejects our token (expired after a day, or revoked): AuthContext signs out. */
export const SESSION_EXPIRED_EVENT = "revotech:session-expired";

function token(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    const t = raw ? (JSON.parse(raw) as { token?: unknown }).token : null;
    return typeof t === "string" && t ? t : null;
  } catch {
    return null; // private mode: the request goes out unauthenticated and the API answers 401
  }
}

/** `Authorization: Bearer <token>` for the signed-in user, or nothing. */
export function authHeaders(): Record<string, string> {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Throw the API's error; a 401 on a request that carried a token means the session is over. */
async function fail(res: Response, sentToken: boolean): Promise<never> {
  if (res.status === 401 && sentToken) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  throw await ApiError.from(res);
}

async function request<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  const auth = authHeaders();
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", accept: "application/json", ...auth },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  if (!res.ok) await fail(res, "Authorization" in auth);
  return (await res.json()) as T;
}

/** For this app's own routes (multipart uploads, page scrapers, cache refresh) under /api. */
async function local<T>(path: string, init: RequestInit = {}) {
  const auth = authHeaders();
  const res = await fetch(`/api${path}`, { ...init, headers: { accept: "application/json", ...auth, ...init.headers } });
  if (!res.ok) await fail(res, "Authorization" in auth);
  return (await res.json()) as T;
}

/**
 * Writes go straight to the Flask API, so the cached pages that show the data (ISR home, product
 * pages, the layout's settings...) are refreshed here, by tag, once a write has succeeded. Best
 * effort: a failure only means the old page shows until its normal revalidation.
 */
async function refreshPages(tags: string[]) {
  try {
    await local("/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) });
  } catch {
    /* ignore */
  }
}

/** Run a write, then refresh the pages tagged `tags`. */
async function write<T>(tags: string[], run: () => Promise<T>): Promise<T> {
  const result = await run();
  await refreshPages(tags);
  return result;
}

const CATALOG = ["catalog"];

/**
 * Tell this app which image URLs a product just stopped using, so the uploads among them that no
 * product uses any more are deleted at once (app/api/uploads/release). Best effort, like
 * refreshPages: whatever it misses, the sweep after the next upload catches.
 */
async function releaseUploads(urls: string[]) {
  if (!urls.length) return;
  try {
    await local("/uploads/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) });
  } catch {
    /* ignore */
  }
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
    write(CATALOG, () => request<Created<"product", Product>>("/products", { method: "POST", body: data })),
  /** saving a new gallery releases the uploads the product no longer uses */
  updateProduct: async (id: number, data: Partial<ProductInput>) => {
    const before = data.images ? (await request<Product>(`/products/${id}`)).images ?? [] : [];
    const res = await write(CATALOG, () => request<Created<"product", Product>>(`/products/${id}`, { method: "PUT", body: data }));
    await releaseUploads(before.filter((url) => !res.product.images?.includes(url)));
    return res;
  },
  /** a deleted product's uploads are released; a withdrawn one keeps its images (still in use) */
  deleteProduct: async (id: number) => {
    const { images = [] } = await request<Product>(`/products/${id}`);
    const res = await write(CATALOG, () => request<{ message: string; id: number; withdrawn?: boolean }>(`/products/${id}`, { method: "DELETE" }));
    await releaseUploads(images);
    return res;
  },

  categories: (signal?: AbortSignal) => request<(Category & { product_count?: number })[]>("/categories", { signal }),
  createCategory: (data: { category_name: string; description?: string }) =>
    write(CATALOG, () => request<Created<"category", Category>>("/categories", { method: "POST", body: data })),
  updateCategory: (id: number, data: { category_name?: string; description?: string }) =>
    write(CATALOG, () => request<Created<"category", Category>>(`/categories/${id}`, { method: "PUT", body: data })),
  deleteCategory: (id: number) =>
    write(CATALOG, () => request<{ message: string; id: number }>(`/categories/${id}`, { method: "DELETE" })),

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

  /* orders - the token decides whose: your own, or every order with orders:manage */
  orders: () => request<Order[]>("/orders"),
  order: (id: number) => request<OrderDetail>(`/orders/${id}`),
  /** placing an order takes stock, so the catalogue pages are refreshed too */
  createOrder: (data: OrderInput) =>
    write(CATALOG, () => request<{ message: string; order: OrderDetail }>("/orders", { method: "POST", body: data })),
  /** cancelling or reopening moves stock (`stock_changed`) */
  updateOrder: async (id: number, data: { order_status?: OrderStatus; shipping_address?: string }) => {
    const res = await request<Created<"order", OrderDetail> & { stock_changed?: boolean }>(`/orders/${id}`, { method: "PUT", body: data });
    if (res.stock_changed) await refreshPages(CATALOG);
    return res;
  },
};

export type { User };

/* ------------------------------------------------------------------ page content */

export const contentApi = {
  home: () => request<HomeContent>("/content/home"),
  saveHome: (data: HomeContent) =>
    write(["content-home"], () => request<{ message: string; content: HomeContent }>("/content/home", { method: "PUT", body: data })),
  about: () => request<AboutContent>("/content/about"),
  saveAbout: (data: AboutContent) =>
    write(["content-about"], () => request<{ message: string; content: AboutContent }>("/content/about", { method: "PUT", body: data })),
};

/* ------------------------------------------------------------------ store settings and logo */

export interface LogoPreview {
  svg: string;
  colours: string[];
  paths: number;
}

/** What this app's logo tracer returns: a preview, and the vector the API stores. */
interface TracedLogo extends LogoPreview {
  vector: unknown;
}

const logoForm = (file: Blob, name: string) => {
  const form = new FormData();
  form.append("file", file, name);
  return form;
};

/** Trace an image into vector paths (this app's /api/logo/vectorize - the API stores, it doesn't trace). */
const traceLogo = (file: Blob, name: string) => local<TracedLogo>("/logo/vectorize", { method: "POST", body: logoForm(file, name) });

const SETTINGS = ["settings"];

export const settingsApi = {
  get: () => request<SiteSettings>("/settings"),
  save: (data: SiteSettings) =>
    write(SETTINGS, () => request<{ message: string; settings: SiteSettings }>("/settings", { method: "PUT", body: data })),
  /** convert an image to an SVG logo without applying it */
  previewLogo: async (file: Blob, name: string): Promise<LogoPreview> => {
    const { svg, colours, paths } = await traceLogo(file, name);
    return { svg, colours, paths };
  },
  /** convert an image and make it the store's logo */
  applyLogo: async (file: Blob, name: string): Promise<LogoPreview & { settings: SiteSettings }> => {
    const { vector, svg, colours, paths } = await traceLogo(file, name);
    const { settings } = await write(SETTINGS, () =>
      request<{ message: string; settings: SiteSettings }>("/settings/logo", { method: "PUT", body: vector })
    );
    return { svg, colours, paths, settings };
  },
  resetLogo: () => write(SETTINGS, () => request<{ message: string; settings: SiteSettings }>("/settings/logo", { method: "DELETE" })),
};

/* ------------------------------------------------------------------ this app's own helpers */

export interface UploadResponse {
  message: string;
  /** an AVIF URL: Vercel Blob in production, /api/images/... in development */
  url: string;
  bytes: number;
  source: { format: string; width: number; height: number; bytes: number };
}

/** POST /api/uploads - any supported image in, AVIF out. */
export function uploadImage(file: Blob, name: string): Promise<UploadResponse> {
  return local<UploadResponse>("/uploads", { method: "POST", body: logoForm(file, name) }); // browser sets the multipart boundary
}

export interface OfficialPreview {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
}

/** GET /api/official-preview - the manufacturer's published summary for a product page. */
export function officialPreview(url: string): Promise<OfficialPreview> {
  return local<OfficialPreview>(`/official-preview?url=${encodeURIComponent(url)}`);
}

export interface SpecsResponse {
  url: string | null;
  specs: SpecRow[];
}

/** GET /api/official-specs - the spec table of a public product or spec page. */
export function officialSpecs(url: string, name: string): Promise<SpecsResponse> {
  return local<SpecsResponse>(`/official-specs?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`);
}

/** POST /api/official-specs - spec rows from HTML the admin copied out of a spec page. */
export function specsFromHtml(html: string, name: string): Promise<SpecsResponse> {
  return local<SpecsResponse>("/official-specs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, name }),
  });
}
