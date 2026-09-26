/**
 * Seeds the product overviews: for every product with an official_url, fetch the short summary
 * the manufacturer publishes for that page (og:description / meta description) and store it
 * in data/catalog.json with overview_source pointing at the page it came from.
 *
 * Summaries that are empty, generic (a site-wide tagline rather than about the product) or
 * blocked are left null - an admin can write those by hand in the dashboard.
 *
 *   node scripts/fetch-overviews.mjs            products that have no overview yet
 *   node scripts/fetch-overviews.mjs --force    refetch all
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSummary } from "../lib/server/page-summary.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data", "catalog.json");
const force = process.argv.includes("--force");
const catalog = JSON.parse(readFileSync(FILE, "utf8"));

/** A summary is only useful if it is about this product, not the manufacturer's homepage blurb. */
function mentionsProduct(text, product) {
  const t = text.toLowerCase();
  const tokens = product.product_name
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && /\d/.test(w)); // model numbers: 250k, 9850x3d, b860m, 5070...
  // the series behind a model number: rm650e -> "rme", matching "CORSAIR RMe Series ..."
  const series = tokens.map((w) => w.replace(/\d/g, "")).filter((w) => w.length >= 3);
  const words = product.product_name.toLowerCase().split(/\s+/).filter((w) => w.length >= 5);
  return (
    tokens.some((w) => t.includes(w)) ||
    series.some((w) => new RegExp(`\\b${w}\\b`).test(t)) ||
    words.filter((w) => t.includes(w)).length >= 2
  );
}

for (const p of catalog.products) {
  if (!p.official_url || (p.overview && !force)) continue;
  process.stdout.write(`  ${p.product_name.padEnd(38)} `);
  try {
    const s = await fetchSummary(p.official_url);
    if (!mentionsProduct(s.description, p) || s.description.length < 60) {
      console.log(`skipped (generic): ${s.description.slice(0, 70)}…`);
      continue;
    }
    p.overview = s.description;
    p.overview_source = s.url;
    console.log(`ok (${s.description.length} chars)`);
  } catch (e) {
    console.log(`none - ${e.message}`);
  }
}

writeFileSync(FILE, JSON.stringify(catalog, null, 2) + "\n");
const n = catalog.products.filter((p) => p.overview).length;
console.log(`\n  ${n}/${catalog.products.length} products have an overview`);
