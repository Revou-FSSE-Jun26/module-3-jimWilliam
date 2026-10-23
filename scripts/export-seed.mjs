/**
 * Writes seed_data.json for the Flask backend (Module 2 repo), generated from this repo's
 * data/catalog.json and the default page content and settings, so the backend's data and
 * this storefront's images and specs can never drift apart. The backend's seed_db.py loads it.
 *
 *   node scripts/export-seed.mjs                       writes ../../Module_02/module-2-jim1504/seed_data.json
 *   node scripts/export-seed.mjs --out=path/to/seed_data.json
 *
 * Only API fields are exported: the storefront-only metadata in the catalogue (slug, kind,
 * brand, socket, watt) feeds lib/generated/product-meta.json instead. Passwords are not
 * exported - seed_db.py gives every seeded account the same demo password.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONTENT } from "../lib/content.ts";
import { DEFAULT_SETTINGS } from "../lib/settings.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length);
const OUT = resolve(outArg ?? join(ROOT, "..", "..", "Module_02", "module-2-jim1504", "seed_data.json"));

const c = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const orNull = (v) => (v === "" || v === undefined ? null : v);

const seed = {
  _generated: "by RevoTech scripts/export-seed.mjs from data/catalog.json - edit the catalogue, not this file",
  categories: c.categories.map(({ category_id, category_name, description }) => ({ category_id, category_name, description })),
  products: c.products.map((p) => ({
    product_id: p.product_id,
    category_id: p.category_id,
    product_name: p.product_name,
    description: orNull(p.description),
    price: p.price,
    stock_quantity: p.stock_quantity,
    is_active: p.is_active,
    official_url: orNull(p.official_url),
    overview: orNull(p.overview),
    overview_source: orNull(p.overview_source),
    images: p.images ?? [],
    specs: p.specs ?? [],
    specs_source: orNull(p.specs_source),
  })),
  users: c.users.map(({ id, username, email, phone_number, address, role }) => ({ id, username, email, phone_number, address, role })),
  orders: c.orders.map(({ order_id, user_id, order_status, shipping_address, ordered_at, items }) => ({
    order_id,
    user_id,
    order_status,
    shipping_address,
    ordered_at,
    items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
  })),
  content: DEFAULT_CONTENT,
  settings: DEFAULT_SETTINGS,
};

writeFileSync(OUT, JSON.stringify(seed, null, 2) + "\n");
console.log(
  `wrote ${OUT}\n  ${seed.categories.length} categories · ${seed.products.length} products · ${seed.users.length} users · ` +
    `${seed.orders.length} orders · ${seed.orders.reduce((n, o) => n + o.items.length, 0)} order items · content + settings`
);
