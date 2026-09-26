/**
 * Turns a folder of manufacturer images into a product gallery, for products whose photos were
 * saved by hand from the official page (scripts/gallery-sources.json lists the folder, the page
 * they came from, and the order - first = primary).
 *
 * Each image becomes a 1600px AVIF tile like every other product photo, plus @800 / @400
 * variants: cut-outs (transparent PNG/WebP/AVIF) are trimmed and centred on the surface colour;
 * photos and infographics are fitted whole, so text in them is never cropped. The primary also
 * gets a blur placeholder, and the product's `images` in data/catalog.json are set to match.
 *
 *   assets/products/<slug>.avif, <slug>-2.avif, <slug>-3.avif ...
 *
 *   node scripts/import-gallery.mjs              every product in gallery-sources.json
 *   node scripts/import-gallery.mjs --only=slug  just one
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { TILE, blurOf, toFullFrameTile, toTile } from "./lib/tile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "products");
const MANIFEST = join(OUT, "manifest.json");
const CATALOG = join(ROOT, "data", "catalog.json");
const WIDTHS = [800, 400];

const sources = JSON.parse(readFileSync(join(ROOT, "scripts", "gallery-sources.json"), "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");

/** A cut-out has real transparency somewhere - not just an alpha channel that is fully opaque. */
async function isCutout(buf) {
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha) return false;
  const { channels } = await sharp(buf).stats();
  return channels[3].min < 250;
}

for (const [slug, src] of Object.entries(sources)) {
  if (only && !only.includes(slug)) continue;
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product) throw new Error(`${slug} is not in data/catalog.json`);
  console.log(`  ${slug}`);

  const images = [];
  for (const [i, file] of src.files.entries()) {
    const buf = readFileSync(join(ROOT, src.folder, file));
    const cutout = await isCutout(buf);
    const tile = cutout ? (await toTile(buf)).tile : await toFullFrameTile(buf);
    const name = i === 0 ? slug : `${slug}-${i + 1}`;
    writeFileSync(join(OUT, `${name}.avif`), tile);
    for (const w of WIDTHS) {
      writeFileSync(join(OUT, `${name}@${w}.avif`), await sharp(tile).resize(w, w).avif({ quality: 58, effort: 5 }).toBuffer());
    }
    images.push(`/products/${name}.avif`);
    const { width, height } = await sharp(buf).metadata();
    console.log(`    ${String(i + 1).padStart(2)}. ${name}.avif  ${width}x${height} ${cutout ? "cut-out" : "full frame"} -> ${Math.round(tile.length / 1024)} KB`);
  }

  const primary = readFileSync(join(OUT, `${slug}.avif`));
  const blur = await blurOf(primary);
  writeFileSync(join(OUT, `${slug}.blur.avif`), blur);
  manifest[slug] = {
    origin: "manufacturer",
    pageUrl: src.pageUrl,
    source: src.folder,
    gallery: images.length,
    tile: `${TILE}x${TILE}`,
    bytes: primary.length,
    whiteKeyed: false,
    blurDataURL: `data:image/avif;base64,${blur.toString("base64")}`,
  };
  product.images = images;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
