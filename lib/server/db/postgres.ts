import "server-only";

import postgres, { type Sql } from "postgres";
import type { ContentKey } from "@/lib/content";
import type { LogoVector } from "@/lib/server/logo";
import type { SiteSettings } from "@/lib/settings";
import type { Category, Product } from "@/lib/types";
import type { DataSource, StoredOrder, StoredOrderItem, StoredUser } from "./types";

/**
 * The catalogue in PostgreSQL - Supabase in production, any Postgres locally. Tables come from
 * db/schema.sql and are seeded by `npm run db:setup`.
 *
 * Connection notes for serverless (Vercel): every function instance opens its own pool, so the
 * pool is small, and `prepare: false` lets it run through Supabase's transaction pooler
 * (port 6543), which cannot keep prepared statements between requests.
 */

const g = globalThis as typeof globalThis & { __revotechSql?: Sql };

function connect(url: string): Sql {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false,
    ssl: local ? false : "require",
    types: {
      // `timestamp` columns come back as "2026-06-01T08:00:00" - the exact shape the Flask
      // to_dict() produces and every component already expects - never as a local-time Date
      timestamp: {
        to: 1114,
        from: [1114],
        serialize: (v: string) => v,
        parse: (v: string) => v.replace(" ", "T").slice(0, 19),
      },
      // NUMERIC(12,2) prices as numbers, not strings
      numeric: { to: 1700, from: [1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) },
    },
  });
}

/** Drop the keys a caller may not update, and wrap arrays/objects for JSONB columns. */
function row(sql: Sql, patch: Record<string, unknown>, locked: string[]) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || locked.includes(k)) continue;
    out[k] = v !== null && typeof v === "object" ? sql.json(v as never) : v;
  }
  return out;
}

/** an order_items row without its order_id - the shape inside an order's `items` */
const line = ({ order_item_id, product_id, quantity, unit_price }: StoredOrderItem): StoredOrderItem => ({ order_item_id, product_id, quantity, unit_price });

export function postgresData(url: string): DataSource {
  const sql = (g.__revotechSql ??= connect(url));

  const update = async <T>(table: string, key: string, id: number, patch: Record<string, unknown>, locked: string[]): Promise<T> => {
    const values = row(sql, patch, [key, ...locked]);
    const [out] = Object.keys(values).length
      ? await sql`update ${sql(table)} set ${sql(values)} where ${sql(key)} = ${id} returning *`
      : await sql`select * from ${sql(table)} where ${sql(key)} = ${id}`;
    return out as T;
  };

  const withItems = async (orders: Omit<StoredOrder, "items">[]): Promise<StoredOrder[]> => {
    if (!orders.length) return [];
    const items = await sql<(StoredOrderItem & { order_id: number })[]>`
      select order_item_id, order_id, product_id, quantity, unit_price
      from order_items where order_id in ${sql(orders.map((o) => o.order_id))} order by order_item_id`;
    return orders.map((o) => ({
      ...o,
      items: items.filter((i) => i.order_id === o.order_id).map(line),
    }));
  };

  return {
    kind: "postgres",

    async categories() {
      return sql<Category[]>`select * from categories order by category_id`;
    },
    async category(id) {
      const [c] = await sql<Category[]>`select * from categories where category_id = ${id}`;
      return c ?? null;
    },
    async addCategory(r) {
      const [c] = await sql<Category[]>`insert into categories ${sql(row(sql, r, []))} returning *`;
      return c;
    },
    saveCategory: (id, patch) => update<Category>("categories", "category_id", id, patch, ["created_at"]),
    async removeCategory(id) {
      await sql`delete from categories where category_id = ${id}`;
    },

    async products() {
      return sql<Product[]>`select * from products order by product_id`;
    },
    async product(id) {
      const [p] = await sql<Product[]>`select * from products where product_id = ${id}`;
      return p ?? null;
    },
    async addProduct(r) {
      const [p] = await sql<Product[]>`insert into products ${sql(row(sql, r, []))} returning *`;
      return p;
    },
    saveProduct: (id, patch) => update<Product>("products", "product_id", id, patch, ["created_at"]),
    async removeProduct(id) {
      await sql`delete from products where product_id = ${id}`;
    },
    async adjustStock(changes) {
      if (!changes.length) return;
      // one transaction, so the whole order's stock moves together or not at all
      await sql.begin(async (tx) => {
        for (const c of changes) {
          await tx`update products set stock_quantity = stock_quantity + ${c.delta} where product_id = ${c.product_id}`;
        }
      });
    },

    async users() {
      return sql<StoredUser[]>`select * from users order by id`;
    },
    async user(id) {
      const [u] = await sql<StoredUser[]>`select * from users where id = ${id}`;
      return u ?? null;
    },
    async userByEmail(email) {
      const [u] = await sql<StoredUser[]>`select * from users where email = ${email}`;
      return u ?? null;
    },
    async addUser(r) {
      const [u] = await sql<StoredUser[]>`insert into users ${sql(row(sql, r, []))} returning *`;
      return u;
    },
    saveUser: (id, patch) => update<StoredUser>("users", "id", id, patch, ["created_at"]),

    async orders() {
      return withItems(await sql<Omit<StoredOrder, "items">[]>`select * from orders order by order_id`);
    },
    async order(id) {
      const [o] = await withItems(await sql<Omit<StoredOrder, "items">[]>`select * from orders where order_id = ${id}`);
      return o ?? null;
    },
    async addOrder({ items, ...order }) {
      return sql.begin(async (tx) => {
        const [o] = await tx<Omit<StoredOrder, "items">[]>`insert into orders ${tx(row(sql, order, []))} returning *`;
        const lines = items.length
          ? await tx<(StoredOrderItem & { order_id: number })[]>`
              insert into order_items ${tx(items.map((i) => ({ order_id: o.order_id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })))}
              returning order_item_id, order_id, product_id, quantity, unit_price`
          : [];
        return { ...o, items: lines.map(line) };
      });
    },
    async saveOrder(id, patch) {
      await update("orders", "order_id", id, patch, ["created_at", "ordered_at", "user_id"]);
      return (await this.order(id))!;
    },

    async content(key) {
      const [r] = await sql<{ content: never }[]>`select content from site_content where key = ${key}`;
      if (!r) throw new Error(`site_content "${key}" is missing - run npm run db:setup`);
      return r.content;
    },
    async saveContent(key: ContentKey, doc) {
      await sql`
        insert into site_content (key, content, updated_at) values (${key}, ${sql.json(doc as never)}, now())
        on conflict (key) do update set content = excluded.content, updated_at = now()`;
    },

    async settings() {
      const [r] = await sql<{ settings: SiteSettings }[]>`select settings from site_settings where id = 1`;
      if (!r) throw new Error("site_settings is empty - run npm run db:setup");
      return r.settings;
    },
    async saveSettings(settings) {
      await sql`update site_settings set settings = ${sql.json(settings as never)}, updated_at = now() where id = 1`;
    },
    async logo() {
      const [r] = await sql<{ logo: LogoVector }[]>`select logo from site_settings where id = 1`;
      if (!r) throw new Error("site_settings is empty - run npm run db:setup");
      return r.logo;
    },
    async saveLogo(logo) {
      await sql`update site_settings set logo = ${sql.json(logo as never)}, updated_at = now() where id = 1`;
    },
  };
}
