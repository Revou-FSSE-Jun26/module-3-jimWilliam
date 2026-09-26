import "server-only";

import catalog from "@/data/catalog.json";
import defaultLogo from "@/data/logo.json";
import type { LogoVector } from "@/lib/server/logo";
import { DEFAULT_SETTINGS, validateSettings, type SiteSettings } from "@/lib/settings";
import { DEFAULT_CONTENT, validateAbout, validateHome, type ContentKey, type SiteContent } from "@/lib/content";
import { can, isRole, ROLES } from "@/lib/roles";
import { SPEC_LIMITS, type SpecRow } from "@/lib/specs";
import { MAX_PRODUCT_IMAGES } from "@/lib/types";
import type {
  ApiErrorBody,
  Category,
  CategoryDetail,
  Order,
  OrderDetail,
  OrderItem,
  OrderStatus,
  Product,
  Role,
  UserRecord,
} from "@/lib/types";

/**
 * In-memory stand-in for the Module 2 Flask API.
 *
 * Every function returns `{ status, body }` with the exact status codes and body shapes the
 * Flask routes produce, so the Route Handlers under app/api are thin adapters and the UI
 * cannot tell the difference. Point NEXT_PUBLIC_API_BASE_URL at the real API and nothing
 * else changes.
 *
 * The store lives on globalThis because Next compiles route handlers and pages into separate
 * module graphs; without this, a product created through POST /api/products would be
 * invisible to the page that lists them. On Vercel each serverless instance still has its
 * own copy and a cold start reseeds it - fine for a demo, and documented in the README.
 */

export interface Result<T = unknown> {
  status: number;
  body: T | ApiErrorBody;
}

interface StoredUser extends UserRecord {
  password: string;
}

interface StoredOrder {
  order_id: number;
  user_id: number;
  order_status: OrderStatus;
  shipping_address: string;
  ordered_at: string;
  items: { order_item_id: number; product_id: number; quantity: number; unit_price: number }[];
}

interface Db {
  categories: Category[];
  products: Product[];
  users: StoredUser[];
  orders: StoredOrder[];
  content: SiteContent;
  settings: SiteSettings;
  logo: LogoVector;
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "shipped"];
const ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled"];
const SEEDED_AT = "2026-06-01T08:00:00";

function seed(): Db {
  let itemId = 0;
  return {
    categories: catalog.categories.map((c) => ({ ...c, created_at: SEEDED_AT })),
    products: catalog.products.map((p) => ({
      product_id: p.product_id,
      category_id: p.category_id,
      product_name: p.product_name,
      description: p.description,
      price: p.price,
      stock_quantity: p.stock_quantity,
      is_active: p.is_active,
      created_at: SEEDED_AT,
      official_url: p.official_url ?? null,
      overview: p.overview ?? null,
      overview_source: p.overview_source ?? null,
      images: p.images,
      specs: p.specs,
      specs_source: p.specs_source,
    })),
    users: catalog.users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      password: u.password,
      phone_number: u.phone_number,
      address: u.address,
      role: u.role as Role,
      created_at: SEEDED_AT,
    })),
    orders: catalog.orders.map((o) => ({
      order_id: o.order_id,
      user_id: o.user_id,
      order_status: o.order_status as OrderStatus,
      shipping_address: o.shipping_address,
      ordered_at: o.ordered_at,
      items: o.items.map((i) => ({ ...i, order_item_id: ++itemId })),
    })),
    content: structuredClone(DEFAULT_CONTENT),
    settings: structuredClone(DEFAULT_SETTINGS),
    logo: defaultLogo as LogoVector,
  };
}

/**
 * Bump whenever the seeded data's shape changes. The store lives on globalThis so it survives
 * dev hot reloads - which also means a running `next dev` would otherwise keep serving data in
 * the old shape (e.g. products without images or official_url) until it was restarted.
 */
const SCHEMA_VERSION = 8;

const g = globalThis as typeof globalThis & { __revotechDb?: Db; __revotechDbVersion?: number };
const db = (): Db => {
  if (!g.__revotechDb || g.__revotechDbVersion !== SCHEMA_VERSION) {
    g.__revotechDb = seed();
    g.__revotechDbVersion = SCHEMA_VERSION;
  }
  return g.__revotechDb;
};

const now = () => new Date().toISOString().slice(0, 19);
const nextId = (ids: number[]) => (ids.length ? Math.max(...ids) + 1 : 1);
const err = (status: number, body: ApiErrorBody): Result<never> => ({ status, body });

/* ------------------------------------------------------------------ helpers */

const isBlank = (v: unknown) => typeof v !== "string" || v.trim() === "";
const toNumber = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

function orderTotal(o: StoredOrder) {
  return o.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
}

function orderSummary(o: StoredOrder): Order {
  const user = db().users.find((u) => u.id === o.user_id);
  return {
    order_id: o.order_id,
    user_id: o.user_id,
    username: user?.username,
    order_status: o.order_status,
    total_amount: orderTotal(o),
    shipping_address: o.shipping_address,
    ordered_at: o.ordered_at,
    item_count: o.items.reduce((n, i) => n + i.quantity, 0),
  };
}

function orderDetail(o: StoredOrder): OrderDetail {
  const items: OrderItem[] = o.items.map((i) => ({
    order_item_id: i.order_item_id,
    product_id: i.product_id,
    product_name: db().products.find((p) => p.product_id === i.product_id)?.product_name ?? "Removed product",
    quantity: i.quantity,
    unit_price: i.unit_price,
    line_total: i.quantity * i.unit_price,
  }));
  return { ...orderSummary(o), items };
}

function publicUser(u: StoredUser): UserRecord {
  const { password: _password, ...rest } = u;
  void _password;
  return rest;
}

/* ------------------------------------------------------------------ products */

/**
 * Gallery entries must be this app's own AVIF files: the seeded product photos, or uploads,
 * which /api/uploads converts to AVIF on arrival. Rejecting anything else is what guarantees
 * every product image is AVIF, whatever format was originally uploaded.
 */
const IMAGE_PATH = /^\/(?:products|api\/images)\/[a-z0-9][\w-]*\.avif$/i;

function isHttpUrl(v: unknown): boolean {
  if (typeof v !== "string" || v.length > 500) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const optText = (v: unknown) => (isBlank(v) ? null : (v as string).trim());

/** Trimmed spec rows, empty groups dropped. Validated first by specsError. */
const toSpecs = (v: unknown): SpecRow[] =>
  (v as SpecRow[]).map(({ group, label, value }) => ({ ...(group?.trim() && { group: group.trim() }), label: label.trim(), value: value.trim() }));

function specsError(v: unknown): string | null {
  if (!Array.isArray(v)) return "specs must be a list";
  if (v.length > SPEC_LIMITS.rows) return `specs can hold at most ${SPEC_LIMITS.rows} rows`;
  const bad = v.findIndex(
    (r) =>
      !r ||
      typeof r !== "object" ||
      isBlank(r.label) ||
      isBlank(r.value) ||
      r.label.length > SPEC_LIMITS.label ||
      r.value.length > SPEC_LIMITS.value ||
      (r.group !== undefined && (typeof r.group !== "string" || r.group.length > SPEC_LIMITS.group))
  );
  return bad === -1
    ? null
    : `specs row ${bad + 1} needs a label (max ${SPEC_LIMITS.label} chars) and a value (max ${SPEC_LIMITS.value}), group at most ${SPEC_LIMITS.group}`;
}

function validateProduct(input: Record<string, unknown>, partial: boolean) {
  const details: string[] = [];
  const has = (k: string) => input[k] !== undefined;

  if (!partial || has("product_name")) {
    if (isBlank(input.product_name)) details.push("product_name is required");
    else if ((input.product_name as string).length > 150) details.push("product_name must be at most 150 characters");
  }
  if (!partial || has("category_id")) {
    const id = toNumber(input.category_id);
    if (!Number.isInteger(id)) details.push("category_id is required");
    else if (!db().categories.some((c) => c.category_id === id)) details.push("category_id does not exist");
  }
  if (!partial || has("price")) {
    const price = toNumber(input.price);
    if (Number.isNaN(price)) details.push("price is required");
    else if (price < 0) details.push("price must be greater than or equal to 0");
  }
  if (!partial || has("stock_quantity")) {
    const stock = toNumber(input.stock_quantity ?? 0);
    if (!Number.isInteger(stock)) details.push("stock_quantity must be an integer");
    else if (stock < 0) details.push("stock_quantity must be greater than or equal to 0");
  }
  if (has("is_active") && typeof input.is_active !== "boolean") details.push("is_active must be a boolean");
  if (has("official_url") && !isBlank(input.official_url) && !isHttpUrl(input.official_url)) {
    details.push("official_url must be an http(s) URL of at most 500 characters");
  }
  if (has("overview") && !isBlank(input.overview)) {
    if (typeof input.overview !== "string") details.push("overview must be text");
    else if (input.overview.length > 2000) details.push("overview must be at most 2000 characters");
  }
  if (has("overview_source") && !isBlank(input.overview_source) && !isHttpUrl(input.overview_source)) {
    details.push("overview_source must be an http(s) URL");
  }
  if (has("specs")) {
    const e = specsError(input.specs);
    if (e) details.push(e);
  }
  if (has("specs_source") && !isBlank(input.specs_source) && !isHttpUrl(input.specs_source)) {
    details.push("specs_source must be an http(s) URL");
  }
  if (has("images")) {
    const imgs = input.images;
    if (!Array.isArray(imgs)) details.push("images must be a list");
    else if (imgs.length > MAX_PRODUCT_IMAGES) details.push(`images can hold at most ${MAX_PRODUCT_IMAGES} pictures`);
    else if (imgs.some((i) => typeof i !== "string" || !IMAGE_PATH.test(i))) {
      details.push("images must be uploaded through /api/uploads (AVIF files served by this app)");
    }
  }
  return details;
}

export function listProducts(query: { search?: string | null; category_id?: string | null }): Result<Product[]> {
  let rows = [...db().products];
  const search = query.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (p) => p.product_name.toLowerCase().includes(search) || (p.description ?? "").toLowerCase().includes(search)
    );
  }
  if (query.category_id) {
    const id = Number(query.category_id);
    rows = rows.filter((p) => p.category_id === id);
  }
  return { status: 200, body: rows.sort((a, b) => a.product_id - b.product_id) };
}

/** Every image URL any product uses - uploads outside this set are safe to delete. */
export function imagesInUse(): Set<string> {
  return new Set(db().products.flatMap((p) => p.images ?? []));
}

export function getProduct(id: number): Result<Product> {
  const p = db().products.find((x) => x.product_id === id);
  return p ? { status: 200, body: p } : err(404, { error: "product not found", id });
}

export function createProduct(input: Record<string, unknown>): Result {
  const details = validateProduct(input, false);
  if (details.length) return err(400, { error: "validation failed", details });

  const product: Product = {
    product_id: nextId(db().products.map((p) => p.product_id)),
    category_id: toNumber(input.category_id),
    product_name: (input.product_name as string).trim(),
    description: isBlank(input.description) ? null : (input.description as string).trim(),
    price: toNumber(input.price),
    stock_quantity: toNumber(input.stock_quantity ?? 0),
    is_active: input.is_active === undefined ? true : Boolean(input.is_active),
    created_at: now(),
    official_url: optText(input.official_url),
    overview: optText(input.overview),
    overview_source: optText(input.overview_source),
    images: Array.isArray(input.images) ? [...new Set(input.images as string[])] : [],
    specs: Array.isArray(input.specs) ? toSpecs(input.specs) : [],
    specs_source: optText(input.specs_source),
  };
  db().products.push(product);
  return { status: 201, body: { message: "product created", product } };
}

export function updateProduct(id: number, input: Record<string, unknown>): Result {
  const current = db().products.find((p) => p.product_id === id);
  if (!current) return err(404, { error: "product not found", id });

  const details = validateProduct(input, true);
  if (details.length) return err(400, { error: "validation failed", details });

  const next: Product = {
    ...current,
    ...(input.product_name !== undefined && { product_name: (input.product_name as string).trim() }),
    ...(input.category_id !== undefined && { category_id: toNumber(input.category_id) }),
    ...(input.price !== undefined && { price: toNumber(input.price) }),
    ...(input.stock_quantity !== undefined && { stock_quantity: toNumber(input.stock_quantity) }),
    ...(input.description !== undefined && {
      description: isBlank(input.description) ? null : (input.description as string).trim(),
    }),
    ...(input.is_active !== undefined && { is_active: Boolean(input.is_active) }),
    ...(input.official_url !== undefined && { official_url: optText(input.official_url) }),
    ...(input.overview !== undefined && { overview: optText(input.overview) }),
    ...(input.overview_source !== undefined && { overview_source: optText(input.overview_source) }),
    ...(input.images !== undefined && { images: [...new Set(input.images as string[])] }),
    ...(input.specs !== undefined && { specs: toSpecs(input.specs) }),
    ...(input.specs_source !== undefined && { specs_source: optText(input.specs_source) }),
  };
  db().products = db().products.map((p) => (p.product_id === id ? next : p));
  return { status: 200, body: { message: "product updated", product: next } };
}

export function deleteProduct(id: number): Result {
  const current = db().products.find((p) => p.product_id === id);
  if (!current) return err(404, { error: "product not found", id });

  const active = db().orders.filter(
    (o) => ACTIVE_ORDER_STATUSES.includes(o.order_status) && o.items.some((i) => i.product_id === id)
  ).length;
  if (active > 0) {
    return err(409, { error: "product cannot be deleted while it has active orders", id, active_orders: active });
  }
  db().products = db().products.filter((p) => p.product_id !== id);
  return { status: 200, body: { message: "product deleted", id } };
}

/* ------------------------------------------------------------------ categories */

function validateCategory(input: Record<string, unknown>, partial: boolean, selfId?: number) {
  const details: string[] = [];
  if (!partial || input.category_name !== undefined) {
    if (isBlank(input.category_name)) details.push("category_name is required");
    else {
      const name = (input.category_name as string).trim();
      if (name.length > 100) details.push("category_name must be at most 100 characters");
      const clash = db().categories.some(
        (c) => c.category_name.toLowerCase() === name.toLowerCase() && c.category_id !== selfId
      );
      if (clash) details.push("category_name already exists");
    }
  }
  return details;
}

export function listCategories(): Result<(Category & { product_count: number })[]> {
  const rows = db()
    .categories.map((c) => ({
      ...c,
      product_count: db().products.filter((p) => p.category_id === c.category_id).length,
    }))
    .sort((a, b) => a.category_id - b.category_id);
  return { status: 200, body: rows };
}

export function getCategory(id: number): Result<CategoryDetail> {
  const c = db().categories.find((x) => x.category_id === id);
  if (!c) return err(404, { error: "category not found", id });
  const products = db().products.filter((p) => p.category_id === id);
  return { status: 200, body: { ...c, products, product_count: products.length } };
}

export function createCategory(input: Record<string, unknown>): Result {
  const details = validateCategory(input, false);
  if (details.length) return err(400, { error: "validation failed", details });
  const category: Category = {
    category_id: nextId(db().categories.map((c) => c.category_id)),
    category_name: (input.category_name as string).trim(),
    description: isBlank(input.description) ? null : (input.description as string).trim(),
    created_at: now(),
  };
  db().categories.push(category);
  return { status: 201, body: { message: "category created", category } };
}

export function updateCategory(id: number, input: Record<string, unknown>): Result {
  const current = db().categories.find((c) => c.category_id === id);
  if (!current) return err(404, { error: "category not found", id });
  const details = validateCategory(input, true, id);
  if (details.length) return err(400, { error: "validation failed", details });
  const next: Category = {
    ...current,
    ...(input.category_name !== undefined && { category_name: (input.category_name as string).trim() }),
    ...(input.description !== undefined && {
      description: isBlank(input.description) ? null : (input.description as string).trim(),
    }),
  };
  db().categories = db().categories.map((c) => (c.category_id === id ? next : c));
  return { status: 200, body: { message: "category updated", category: next } };
}

export function deleteCategory(id: number): Result {
  const current = db().categories.find((c) => c.category_id === id);
  if (!current) return err(404, { error: "category not found", id });
  const count = db().products.filter((p) => p.category_id === id).length;
  if (count > 0) {
    return err(409, { error: "category cannot be deleted while products belong to it", id, product_count: count });
  }
  db().categories = db().categories.filter((c) => c.category_id !== id);
  return { status: 200, body: { message: "category deleted", id } };
}

/* ------------------------------------------------------------------ users & auth */

export function registerUser(input: Record<string, unknown>): Result {
  const missing = ["username", "email", "password"].filter((k) => isBlank(input[k]));
  if (missing.length) return err(400, { error: "missing required fields", fields: missing });

  const email = (input.email as string).trim().toLowerCase();
  if (db().users.some((u) => u.email === email)) return err(409, { error: "email already registered" });

  const user: StoredUser = {
    id: nextId(db().users.map((u) => u.id)),
    username: (input.username as string).trim(),
    email,
    password: input.password as string,
    phone_number: isBlank(input.phone_number) ? null : (input.phone_number as string),
    address: isBlank(input.address) ? null : (input.address as string),
    // Self-registration always creates a customer; admins are seeded, never self-granted.
    role: "customer",
    created_at: now(),
  };
  db().users.push(user);
  return { status: 201, body: { message: "user registered", user: publicUser(user) } };
}

export function login(input: Record<string, unknown>): Result {
  const missing = ["email", "password"].filter((k) => isBlank(input[k]));
  if (missing.length) return err(400, { error: "missing required fields", fields: missing });

  const email = (input.email as string).trim().toLowerCase();
  const user = db().users.find((u) => u.email === email && u.password === input.password);
  if (!user) return err(401, { error: "invalid email or password" });

  // Not a real JWT - the mock API has no protected endpoints. Shaped like one so the
  // client code is ready for the Flask API, which does issue signed tokens.
  const access_token = `mock.${Buffer.from(JSON.stringify({ sub: user.id, role: user.role })).toString("base64url")}.sig`;
  return { status: 200, body: { message: "login successful", access_token, user: publicUser(user) } };
}

export function getUser(id: number): Result {
  const u = db().users.find((x) => x.id === id);
  return u ? { status: 200, body: publicUser(u) } : err(404, { error: "user not found", id });
}

/** The user behind a request, for the permission check in lib/server/auth.ts. */
export function findUser(id: number): UserRecord | null {
  const u = db().users.find((x) => x.id === id);
  return u ? publicUser(u) : null;
}

/** Everyone, newest last - the superadmin's user list. */
export function listUsers(): Result<UserRecord[]> {
  return { status: 200, body: db().users.map(publicUser).sort((a, b) => a.id - b.id) };
}

const MIN_PASSWORD = 8;

/**
 * PUT /users/:id. What may change depends on who is asking, so the route passes the actor in:
 *
 *   own profile   username, email, phone_number, address; password with the current one
 *   users:manage  the same for anyone, a password reset without the current one, and the role
 *
 * Guard rails: an email can only belong to one account, nobody may change their own role (an
 * accidental self-demotion would lock the dashboard), and the last superadmin stays one.
 */
export function updateUser(id: number, input: Record<string, unknown>, actor: { id: number; role: Role }): Result {
  const target = db().users.find((u) => u.id === id);
  if (!target) return err(404, { error: "user not found", id });

  const manager = can(actor.role, "users:manage");
  const self = actor.id === id;
  if (!manager && !self) return err(403, { error: "you can only edit your own profile" });

  const details: string[] = [];
  const next: StoredUser = { ...target };
  const has = (k: string) => input[k] !== undefined;

  if (has("username")) {
    if (isBlank(input.username)) details.push("username is required");
    else next.username = (input.username as string).trim();
  }
  if (has("email")) {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) details.push("email must be an email address");
    else if (db().users.some((u) => u.email === email && u.id !== id)) return err(409, { error: "email already registered" });
    else next.email = email;
  }
  if (has("phone_number")) next.phone_number = isBlank(input.phone_number) ? null : (input.phone_number as string).trim();
  if (has("address")) next.address = isBlank(input.address) ? null : (input.address as string).trim();

  if (has("password")) {
    const password = String(input.password ?? "");
    if (password.length < MIN_PASSWORD) details.push(`password must be at least ${MIN_PASSWORD} characters`);
    // changing your own password needs the current one, even as a superadmin
    else if (self && input.current_password !== target.password) details.push("current password is not correct");
    else next.password = password;
  }

  if (has("role")) {
    if (!manager) return err(403, { error: "only a superadmin can change roles" });
    if (!isRole(input.role)) details.push(`role must be one of ${ROLES.join(", ")}`);
    else if (self && input.role !== target.role) details.push("you cannot change your own role");
    else if (target.role === "superadmin" && input.role !== "superadmin" && db().users.filter((u) => u.role === "superadmin").length === 1) {
      details.push("the last superadmin cannot be demoted");
    } else next.role = input.role;
  }

  if (details.length) return err(400, { error: "validation failed", details });

  db().users = db().users.map((u) => (u.id === id ? next : u));
  return { status: 200, body: { message: "user updated", user: publicUser(next) } };
}

/* ------------------------------------------------------------------ orders */

export function listOrders(query: { user_id?: string | null }): Result<Order[]> {
  let rows = db().orders;
  if (query.user_id) rows = rows.filter((o) => o.user_id === Number(query.user_id));
  return {
    status: 200,
    body: rows.map(orderSummary).sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)),
  };
}

export function getOrder(id: number): Result<OrderDetail> {
  const o = db().orders.find((x) => x.order_id === id);
  return o ? { status: 200, body: orderDetail(o) } : err(404, { error: "order not found", id });
}

export function createOrder(input: Record<string, unknown>): Result {
  const details: string[] = [];
  const userId = toNumber(input.user_id);
  if (!Number.isInteger(userId) || !db().users.some((u) => u.id === userId)) details.push("user_id must reference an existing user");
  if (isBlank(input.shipping_address)) details.push("shipping_address is required");

  const status = (input.order_status as OrderStatus | undefined) ?? "pending";
  if (!ORDER_STATUSES.includes(status)) details.push(`order_status must be one of ${ORDER_STATUSES.join(", ")}`);

  const rawItems = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];
  if (rawItems.length === 0) details.push("items must be a non-empty list");

  const lines: { product: Product; quantity: number }[] = [];
  const seen = new Set<number>();
  rawItems.forEach((raw, idx) => {
    const pid = toNumber(raw.product_id);
    const qty = toNumber(raw.quantity ?? 1);
    const product = db().products.find((p) => p.product_id === pid);
    if (!product) return void details.push(`items[${idx}].product_id does not exist`);
    if (seen.has(pid)) return void details.push(`items[${idx}] duplicates product ${pid}`);
    seen.add(pid);
    if (!product.is_active) return void details.push(`${product.product_name} is not available`);
    if (!Number.isInteger(qty) || qty < 1) return void details.push(`items[${idx}].quantity must be at least 1`);
    if (qty > product.stock_quantity) {
      return void details.push(`only ${product.stock_quantity} left of ${product.product_name}`);
    }
    lines.push({ product, quantity: qty });
  });

  if (details.length) return err(400, { error: "validation failed", details });

  let itemId = Math.max(0, ...db().orders.flatMap((o) => o.items.map((i) => i.order_item_id)));
  const order: StoredOrder = {
    order_id: nextId(db().orders.map((o) => o.order_id)),
    user_id: userId,
    order_status: status,
    shipping_address: (input.shipping_address as string).trim(),
    ordered_at: now(),
    items: lines.map((l) => ({
      order_item_id: ++itemId,
      product_id: l.product.product_id,
      quantity: l.quantity,
      unit_price: l.product.price,
    })),
  };

  // decrement stock only once every line has passed validation
  db().products = db().products.map((p) => {
    const line = lines.find((l) => l.product.product_id === p.product_id);
    return line ? { ...p, stock_quantity: p.stock_quantity - line.quantity } : p;
  });
  db().orders.push(order);
  return { status: 201, body: { message: "order created", order: orderDetail(order) } };
}

/**
 * PUT /orders/:id - same contract as the Flask route: order_status and/or shipping_address,
 * 400 "no fields to update" for an empty body, 400 { error: "validation failed", details } for
 * a bad status or a blank address, 404 for an unknown id, 200 { message, order } otherwise.
 * Any status can follow any other, as in Flask.
 *
 * One addition: this mock takes stock off when an order is placed (the Flask API doesn't track
 * stock per order), so cancelling puts the items back and reopening a cancelled order takes
 * them again - refused if there's no longer enough stock.
 */
export function updateOrder(id: number, input: Record<string, unknown>): Result {
  const order = db().orders.find((o) => o.order_id === id);
  if (!order) return err(404, { error: "order not found", id });
  if (!input || Object.keys(input).length === 0) return err(400, { error: "no fields to update" });

  const next = { ...order };
  if ("order_status" in input) {
    if (!ORDER_STATUSES.includes(input.order_status as OrderStatus)) {
      return err(400, { error: "validation failed", details: [`order_status must be one of ${ORDER_STATUSES.join(", ")}`] });
    }
    next.order_status = input.order_status as OrderStatus;
  }
  if ("shipping_address" in input) {
    const address = String(input.shipping_address ?? "").trim();
    if (!address) return err(400, { error: "validation failed", details: ["shipping_address must not be blank"] });
    next.shipping_address = address;
  }

  const cancelling = order.order_status !== "cancelled" && next.order_status === "cancelled";
  const reopening = order.order_status === "cancelled" && next.order_status !== "cancelled";
  if (reopening) {
    const short = order.items
      .map((i) => ({ i, p: db().products.find((p) => p.product_id === i.product_id) }))
      .filter(({ i, p }) => p && p.stock_quantity < i.quantity)
      .map(({ p }) => `only ${p!.stock_quantity} left of ${p!.product_name}`);
    if (short.length) return err(400, { error: "validation failed", details: short });
  }
  if (cancelling || reopening) {
    const sign = cancelling ? 1 : -1;
    db().products = db().products.map((p) => {
      const line = order.items.find((i) => i.product_id === p.product_id);
      return line ? { ...p, stock_quantity: p.stock_quantity + sign * line.quantity } : p;
    });
  }

  db().orders = db().orders.map((o) => (o.order_id === id ? next : o));
  return { status: 200, body: { message: "order updated", order: orderDetail(next), stock_changed: cancelling || reopening } };
}

/* ------------------------------------------------------------------ site content */

const CONTENT_KEYS: ContentKey[] = ["home", "about"];

export function getContent(key: string): Result {
  if (!CONTENT_KEYS.includes(key as ContentKey)) return err(404, { error: `content "${key}" not found` });
  return { status: 200, body: db().content[key as ContentKey] };
}

/** PUT replaces the whole document, validated with the same rules the admin form uses. */
export function updateContent(key: string, input: Record<string, unknown>): Result {
  if (!CONTENT_KEYS.includes(key as ContentKey)) return err(404, { error: `content "${key}" not found` });
  const details =
    key === "home" ? validateHome(input, db().products.map((p) => p.product_id)) : validateAbout(input);
  if (details.length) return err(400, { error: "validation failed", details });
  const doc = structuredClone(input) as unknown as SiteContent[ContentKey];
  db().content = { ...db().content, [key]: doc };
  return { status: 200, body: { message: "content updated", content: doc } };
}

/* ------------------------------------------------------------------ settings */

export function getSettings(): Result<SiteSettings> {
  return { status: 200, body: db().settings };
}

/** PUT replaces the settings; logo_version is the server's to change, so it is kept as is. */
export function updateSettings(input: Record<string, unknown>): Result {
  const details = validateSettings(input);
  if (details.length) return err(400, { error: "validation failed", details });
  const next: SiteSettings = {
    shop_name: (input.shop_name as string).trim(),
    tagline: (input.tagline as string).trim(),
    timezone: input.timezone as string,
    clock: input.clock as SiteSettings["clock"],
    date_style: input.date_style as SiteSettings["date_style"],
    support_email: (input.support_email as string).trim(),
    support_phone: (input.support_phone as string).trim(),
    logo_glow: input.logo_glow as boolean,
    logo_version: db().settings.logo_version,
  };
  db().settings = next;
  return { status: 200, body: { message: "settings updated", settings: next } };
}

export const getLogo = (): LogoVector => db().logo;

/** A new logo (already converted to SVG paths), or null to go back to the default one. */
export function setLogo(logo: LogoVector | null): SiteSettings {
  db().logo = logo ?? (defaultLogo as LogoVector);
  db().settings = { ...db().settings, logo_version: db().settings.logo_version + 1 };
  return db().settings;
}
