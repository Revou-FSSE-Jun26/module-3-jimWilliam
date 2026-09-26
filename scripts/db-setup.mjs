/**
 * Creates the RevoTech tables in a PostgreSQL database and seeds them from data/catalog.json -
 * the same catalogue the in-memory store uses, so a fresh Supabase project starts exactly where
 * `npm run dev` does.
 *
 *   npm run db:setup              create tables if missing; seed only an empty database
 *   npm run db:setup -- --reset   drop every RevoTech table first, then create and seed (destructive)
 *
 * Reads DATABASE_URL from the environment, or from .env.local. Use Supabase's *session* pooler or
 * direct connection (port 5432) here - the setup runs a multi-statement schema file, which the
 * transaction pooler (6543) the deployed app uses does not handle well.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { DEFAULT_CONTENT } from "../lib/content.ts";
import { DEFAULT_SETTINGS } from "../lib/settings.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL && existsSync(join(ROOT, ".env.local"))) process.loadEnvFile(join(ROOT, ".env.local"));
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set - add it to .env.local (see .env.example), or pass it inline.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, {
  max: 1,
  ssl: local ? false : "require",
  onnotice: () => {},
  // send "2026-06-01T08:00:00" to the TIMESTAMP columns as written - the default serializer would
  // read it as this machine's local time and shift it to UTC (08:00 in Jakarta becomes 01:00)
  types: { timestamp: { to: 1114, from: [1114], serialize: (v) => v, parse: (v) => v } },
});
const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const logo = JSON.parse(readFileSync(join(ROOT, "data", "logo.json"), "utf8"));
const SEEDED_AT = "2026-06-01T08:00:00";
const TABLES = ["order_items", "orders", "products", "categories", "users", "site_content", "site_settings"];

try {
  const host = new URL(url).host.replace(/:[^@]*@/, ":***@");
  console.log(`  database  ${host}${new URL(url).pathname}`);

  if (reset) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${TABLES.join(", ")} CASCADE`);
    console.log("  dropped   " + TABLES.join(", "));
  }
  await sql.unsafe(readFileSync(join(ROOT, "db", "schema.sql"), "utf8"));
  console.log("  schema    db/schema.sql applied");

  const [{ count }] = await sql`select count(*)::int as count from categories`;
  if (count > 0) {
    console.log(`  seed      skipped - the database already has data (use --reset to start over)`);
  } else {
    await sql.begin(async (tx) => {
      await tx`insert into categories ${tx(catalog.categories.map((c) => ({ ...c, created_at: SEEDED_AT })))}`;
      await tx`insert into products ${tx(
        catalog.products.map((p) => ({
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
          specs_source: p.specs_source ?? null,
          images: tx.json(p.images),
          specs: tx.json(p.specs),
        }))
      )}`;
      await tx`insert into users ${tx(
        catalog.users.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          password_hash: u.password_hash,
          phone_number: u.phone_number,
          address: u.address,
          role: u.role,
          created_at: SEEDED_AT,
        }))
      )}`;
      await tx`insert into orders ${tx(
        catalog.orders.map((o) => ({
          order_id: o.order_id,
          user_id: o.user_id,
          order_status: o.order_status,
          shipping_address: o.shipping_address,
          ordered_at: o.ordered_at,
        }))
      )}`;
      await tx`insert into order_items ${tx(
        catalog.orders.flatMap((o) =>
          o.items.map((i) => ({ order_id: o.order_id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }))
        )
      )}`;
      for (const [key, doc] of Object.entries(DEFAULT_CONTENT)) {
        await tx`insert into site_content (key, content) values (${key}, ${tx.json(doc)})`;
      }
      await tx`insert into site_settings (id, settings, logo) values (1, ${tx.json(DEFAULT_SETTINGS)}, ${tx.json(logo)})`;

      // the rows were inserted with their ids, so move each sequence past the highest one
      for (const [table, column] of [
        ["categories", "category_id"],
        ["products", "product_id"],
        ["users", "id"],
        ["orders", "order_id"],
        ["order_items", "order_item_id"],
      ]) {
        await tx.unsafe(`SELECT setval(pg_get_serial_sequence('${table}', '${column}'), (SELECT MAX(${column}) FROM ${table}))`);
      }
    });
    console.log("  seed      data/catalog.json + default content, settings and logo");
  }

  const counts = await Promise.all(TABLES.map(async (t) => [t, (await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n]));
  console.log("  rows      " + counts.map(([t, n]) => `${t} ${n}`).join(" · "));
} catch (e) {
  console.error(`\n  db:setup failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
