import catalog from "@/data/catalog.json";
import defaultLogo from "@/data/logo.json";
import { DEFAULT_CONTENT, type ContentKey, type SiteContent } from "@/lib/content";
import type { Role } from "@/lib/roles";
import type { LogoVector } from "@/lib/server/logo";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";
import type { Category, OrderStatus, Product } from "@/lib/types";
import type { DataSource, StoredOrder, StoredUser } from "./types";

/**
 * The catalogue in memory, seeded from data/catalog.json. This is what runs with no
 * DATABASE_URL set: `npm run dev` needs no database, and the Playwright suite gets the same
 * known state on every run.
 *
 * It lives on globalThis because Next compiles route handlers and pages into separate module
 * graphs - without that, a product created through POST /api/products would be invisible to the
 * page that lists them. On Vercel each serverless instance still holds its own copy and a cold
 * start reseeds it, which is exactly why production sets DATABASE_URL.
 */

const SEEDED_AT = "2026-06-01T08:00:00";

/** Bump when the shape of the seeded data changes, so a running dev server reseeds itself. */
const SCHEMA_VERSION = 9;

interface Tables {
  categories: Category[];
  products: Product[];
  users: StoredUser[];
  orders: StoredOrder[];
  content: SiteContent;
  settings: SiteSettings;
  logo: LogoVector;
}

function seed(): Tables {
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
      password_hash: u.password_hash,
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

const g = globalThis as typeof globalThis & { __revotechDb?: Tables; __revotechDbVersion?: number };
const t = (): Tables => {
  if (!g.__revotechDb || g.__revotechDbVersion !== SCHEMA_VERSION) {
    g.__revotechDb = seed();
    g.__revotechDbVersion = SCHEMA_VERSION;
  }
  return g.__revotechDb;
};

const nextId = (ids: number[]) => (ids.length ? Math.max(...ids) + 1 : 1);
const clone = <T>(v: T): T => structuredClone(v);

export function memoryData(): DataSource {
  return {
    kind: "memory",

    async categories() {
      return clone(t().categories);
    },
    async category(id) {
      return clone(t().categories.find((c) => c.category_id === id) ?? null);
    },
    async addCategory(row) {
      const created = { ...row, category_id: nextId(t().categories.map((c) => c.category_id)) };
      t().categories.push(created);
      return clone(created);
    },
    async saveCategory(id, patch) {
      const next = { ...t().categories.find((c) => c.category_id === id)!, ...patch };
      t().categories = t().categories.map((c) => (c.category_id === id ? next : c));
      return clone(next);
    },
    async removeCategory(id) {
      t().categories = t().categories.filter((c) => c.category_id !== id);
    },

    async products() {
      return clone(t().products);
    },
    async product(id) {
      return clone(t().products.find((p) => p.product_id === id) ?? null);
    },
    async addProduct(row) {
      const created = { ...row, product_id: nextId(t().products.map((p) => p.product_id)) };
      t().products.push(created);
      return clone(created);
    },
    async saveProduct(id, patch) {
      const next = { ...t().products.find((p) => p.product_id === id)!, ...patch };
      t().products = t().products.map((p) => (p.product_id === id ? next : p));
      return clone(next);
    },
    async removeProduct(id) {
      t().products = t().products.filter((p) => p.product_id !== id);
    },
    async adjustStock(changes) {
      t().products = t().products.map((p) => {
        const change = changes.find((c) => c.product_id === p.product_id);
        return change ? { ...p, stock_quantity: p.stock_quantity + change.delta } : p;
      });
    },

    async users() {
      return clone(t().users);
    },
    async user(id) {
      return clone(t().users.find((u) => u.id === id) ?? null);
    },
    async userByEmail(email) {
      return clone(t().users.find((u) => u.email === email) ?? null);
    },
    async addUser(row) {
      const created = { ...row, id: nextId(t().users.map((u) => u.id)) };
      t().users.push(created);
      return clone(created);
    },
    async saveUser(id, patch) {
      const next = { ...t().users.find((u) => u.id === id)!, ...patch };
      t().users = t().users.map((u) => (u.id === id ? next : u));
      return clone(next);
    },

    async orders() {
      return clone(t().orders);
    },
    async order(id) {
      return clone(t().orders.find((o) => o.order_id === id) ?? null);
    },
    async addOrder(row) {
      let itemId = Math.max(0, ...t().orders.flatMap((o) => o.items.map((i) => i.order_item_id)));
      const created: StoredOrder = {
        ...row,
        order_id: nextId(t().orders.map((o) => o.order_id)),
        items: row.items.map((i) => ({ ...i, order_item_id: ++itemId })),
      };
      t().orders.push(created);
      return clone(created);
    },
    async saveOrder(id, patch) {
      const next = { ...t().orders.find((o) => o.order_id === id)!, ...patch };
      t().orders = t().orders.map((o) => (o.order_id === id ? next : o));
      return clone(next);
    },

    async content(key) {
      return clone(t().content[key]);
    },
    async saveContent(key: ContentKey, doc) {
      t().content = { ...t().content, [key]: clone(doc) };
    },

    async settings() {
      return clone(t().settings);
    },
    async saveSettings(settings) {
      t().settings = clone(settings);
    },
    async logo() {
      return clone(t().logo);
    },
    async saveLogo(logo) {
      t().logo = clone(logo);
    },
  };
}
