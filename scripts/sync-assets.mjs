/**
 * Runs automatically before `next dev` and `next build` (predev / prebuild).
 *
 * 1. Copies the AVIF masters from assets/ into public/ so next/image can serve them. The
 *    copies are gitignored - assets/ stays the single source of truth.
 * 2. Writes lib/generated/product-meta.json: the per-product presentation data the UI needs
 *    (image, blur placeholder, component kind, socket, wattage). It is generated rather than
 *    imported from data/catalog.json directly because the catalogue also holds the seeded
 *    users - and their passwords - which must never end up in a client bundle.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const dir of ["products", "banners"]) {
  const from = join(ROOT, "assets", dir);
  const to = join(ROOT, "public", dir);
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from).filter((f) => f.endsWith(".avif"));
  for (const f of files) cpSync(join(from, f), join(to, f));
  console.log(`  assets/${dir} -> public/${dir}  (${files.length} files)`);
}

const catalog = JSON.parse(readFileSync(join(ROOT, "data", "catalog.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "assets", "products", "manifest.json"), "utf8"));

const products = Object.fromEntries(
  catalog.products.map((p) => [
    p.product_id,
    {
      slug: p.slug,
      kind: p.kind,
      brand: p.brand,
      socket: p.socket,
      watt: p.watt,
      image: p.images[0],
      blurDataURL: manifest[p.slug]?.blurDataURL ?? null,
      origin: manifest[p.slug]?.origin ?? "generated",
    },
  ])
);
const categories = Object.fromEntries(
  catalog.categories.map((c) => [
    c.category_id,
    {
      image: `/products/category-${c.category_id}.avif`,
      blurDataURL: manifest[`category-${c.category_id}`]?.blurDataURL ?? null,
      accent: manifest[`category-${c.category_id}`]?.accent ?? "#22d3ee",
    },
  ])
);
const banners = JSON.parse(readFileSync(join(ROOT, "assets", "banners", "index.json"), "utf8"));

mkdirSync(join(ROOT, "lib", "generated"), { recursive: true });
writeFileSync(
  join(ROOT, "lib", "generated", "product-meta.json"),
  JSON.stringify({ products, categories, banners }, null, 2) + "\n"
);
console.log(`  lib/generated/product-meta.json  (${Object.keys(products).length} products)`);
