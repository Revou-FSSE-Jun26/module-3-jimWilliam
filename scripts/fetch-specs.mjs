/**
 * Seeds the technical specifications: for every product, fetch its spec page (specs_source,
 * or the official_url when there is no separate spec page) and store the extracted rows in
 * data/catalog.json.
 *
 * Pages that build their spec table with JavaScript (ASUS, Gigabyte, Samsung, Logitech ...)
 * yield nothing from a plain fetch; those are reported and left empty - paste them in from the
 * browser in the dashboard instead.
 *
 *   node scripts/fetch-specs.mjs            products that have no specs yet
 *   node scripts/fetch-specs.mjs --force    refetch all
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSpecs } from "../lib/server/page-specs.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data", "catalog.json");
const force = process.argv.includes("--force");
const catalog = JSON.parse(readFileSync(FILE, "utf8"));
/** Fewer rows than this is a page's feature call-outs, not its spec table. */
const MIN_ROWS = 6;

for (const p of catalog.products) {
  const url = p.specs_source ?? p.official_url;
  if (!url || (p.specs.length && !force)) continue;
  try {
    const { url: finalUrl, specs } = await fetchSpecs(url, p.product_name);
    if (specs.length < MIN_ROWS) {
      console.log(`  - #${p.product_id} ${p.product_name}: only ${specs.length} rows, skipped`);
      continue;
    }
    p.specs = specs;
    p.specs_source = finalUrl;
    console.log(`  ✓ #${p.product_id} ${p.product_name}: ${specs.length} rows`);
  } catch (e) {
    console.log(`  - #${p.product_id} ${p.product_name}: ${e.message}`);
  }
}

writeFileSync(FILE, JSON.stringify(catalog, null, 2) + "\n");
